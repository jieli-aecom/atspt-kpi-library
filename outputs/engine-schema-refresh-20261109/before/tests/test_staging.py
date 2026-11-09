"""Regression checks for schema staging, units, and unknown derived values."""

import unittest
from unittest.mock import patch

import pandas as pd

from src.calculators import travel_time_index
from src.data_interface.staging import field_status, stage_fields
from src.data_interface.validation import _joins, load_schema, validate_table
from src.pipeline.context import RunContext, SpatialScale
from src.preparators.calibrate_network_output import process


class StagingTests(unittest.TestCase):
    def setUp(self):
        self.network = pd.DataFrame(index=pd.Index(["a", "b", "c", "new"], name="link_id"))
        for period in ("am", "pm", "md", "ov"):
            self.network[f"volume_{period}"] = pd.array([100, 200, 0, 300], dtype="Float64")
            self.network[f"medium_truck_ratio_{period}"] = pd.array([10, None, 0, 5], dtype="Float64")
            self.network[f"heavy_truck_ratio_{period}"] = pd.array([5, 10, 0, 5], dtype="Float64")
            self.network[f"vc_{period}"] = 99
            self.network[f"capacity_{period}"] = 999
            self.network[f"truck_volume_{period}"] = 999
        self.network = stage_fields(self.network, "ScenarioUpstream", "NetworkOutput")

    def test_upstream_staging_drops_obsolete_fields(self):
        self.assertFalse(any(c.startswith("truck_volume_") for c in self.network))
        links = pd.DataFrame({"is_hrn": True}, index=self.network.index)
        self.assertNotIn("is_hrn", stage_fields(links, "ScenarioUpstream", "ScenarioLinks"))
        self.assertFalse(any(c.startswith("vc_") for c in self.network))
        self.assertNotIn("capacity_am", self.network)
        self.assertEqual(str(self.network["occupancy_am"].dtype), "Float64")
        self.assertTrue(self.network["occupancy_am"].isna().all())

    def test_network_status_uses_current_fields(self):
        status = field_status(self.network, "ScenarioUpstream", "NetworkOutput")
        self.assertEqual(status["fields_with_missing_values"]["occupancy_am"], 100)
        self.assertFalse(any(k.startswith("truck_volume_") for fields in status.values() for k in fields))
        self.assertNotIn("occupancy_am", status["completed_fields"])

    def test_base_year_tdm_drops_removed_capacity_fields(self):
        frame = pd.DataFrame({"base_year_capacity_am": [100]}, index=pd.Index(["a"], name="link_id"))
        staged = stage_fields(frame, "PreprocessedConstants", "BaseYearTDM")
        self.assertNotIn("base_year_capacity_am", staged)
        self.assertEqual(str(staged["base_year_medium_truck_ratio_am"].dtype), "Float64")
        self.assertTrue(staged["base_year_medium_truck_ratio_am"].isna().all())

    def test_calibrated_vc_uses_period_hours_and_scenario_link(self):
        links = pd.DataFrame(
            {"distance_miles": [2., 3., 4., 5.],
             "capacity": pd.array([1200, 0, 100, None], dtype="Float64")},
            index=self.network.index,
        )
        # Different link order must not change ID alignment.
        # Calibrated truck volume derives from percentages, not a stale input volume.
        self.network["truck_volume_am"] = 999
        output = process(self.network, links.iloc[::-1])
        self.assertEqual(output.loc["a", "calibrated_truck_volume_am"], 15)
        self.assertTrue(pd.isna(output.loc["b", "calibrated_truck_volume_am"]))
        self.assertEqual(output.loc["c", "calibrated_truck_volume_am"], 0)
        self.assertEqual(output.loc["a", "calibrated_vc_am"], 25)
        self.assertAlmostEqual(output.loc["a", "calibrated_vc_pm"], 100 / 3)
        self.assertEqual(output.loc["a", "calibrated_vc_md"], 50)
        self.assertAlmostEqual(output.loc["a", "calibrated_vc_ov"], 100 * 11 / 12)
        self.assertEqual(output.loc["c", "calibrated_vc_am"], 0)
        self.assertTrue(pd.isna(output.loc["b", "calibrated_vc_am"]))
        self.assertTrue(pd.isna(output.loc["new", "calibrated_vc_am"]))
        self.assertEqual(output.loc["a", "total_daily_truck_vmt"], 120)
        self.assertTrue(pd.isna(output.loc["b", "total_daily_truck_vmt"]))
        status = field_status(output, "KPIPreparation", "CalibratedNetworkOutput")
        self.assertIn("PeriodHours", status["problematic_fields"]["calibrated_vc_am"])
        self.assertNotIn("calibrated_vc", output)

    def test_invalid_capacities_stay_unknown(self):
        links = pd.DataFrame(
            {"distance_miles": 1.,
             "capacity": pd.array([-1, float("inf"), None, 0], dtype="Float64")},
            index=self.network.index,
        )
        self.assertTrue(process(self.network, links)["calibrated_vc_am"].isna().all())

    def test_scenario_link_outputs_include_additions_and_pad_missing_inputs(self):
        ids = pd.Index(["new", "a", "no_model", "removed"], name="link_id")
        links = pd.DataFrame({
            "distance_miles": 1., "capacity": 1200., "free_flow_speed_mph": 60.,
            "is_removed_from_base": [False, False, False, True],
        }, index=ids)
        network = self.network.loc[["a", "new"]]
        calibrated = process(network, links)
        self.assertTrue(calibrated.index.equals(ids))
        self.assertTrue(calibrated.loc["no_model"].isna().all())

        base = pd.DataFrame({"corridor_id": ["C"], "subregion_ids": [["S"]]},
                            index=network.loc[["a"]].index)
        calibrated.loc[["a", "new"], "calibrated_travel_minutes_am"] = [1., 2.]
        outputs = travel_time_index.process(base, links, calibrated)
        tti = outputs[SpatialScale.LINKS]["travel_time_index_am"]
        self.assertTrue(tti.index.equals(ids))
        self.assertEqual(tti["new"], 2.)
        self.assertTrue(tti.loc[["no_model", "removed"]].isna().all())
        self.assertEqual(outputs[SpatialScale.CORRIDORS].at["C", "travel_time_index_am"], 1.)
        self.assertAlmostEqual(outputs[SpatialScale.REGION].at["Region", "travel_time_index_am"], 1.75)


class ScenarioLinkJoinTests(unittest.TestCase):
    def setUp(self):
        # Use the exported relationship, which does not carry AllowMissingWhen.
        schema = load_schema()
        self.schema = {}
        names = {"BaseHighwayLinks", "ScenarioLinks"}
        for category, table in (
            ("PreprocessedConstants", "BaseHighwayLinks"),
            ("ScenarioUpstream", "ScenarioLinks"),
        ):
            definition = schema[category][table]
            definition["Joins"] = [j for j in definition["Joins"] if j["With"] in names]
            for join in definition["Joins"]:
                join.pop("AllowMissingWhen", None)
            self.schema[category] = {table: definition}
        self.base = stage_fields(
            pd.DataFrame(index=pd.Index(["existing"], name="link_id")),
            "PreprocessedConstants", "BaseHighwayLinks",
        )
        self.links = stage_fields(
            pd.DataFrame(
                {"is_added_to_base": pd.array([False, True], dtype="boolean")},
                index=pd.Index(["existing", "new"], name="link_id"),
            ),
            "ScenarioUpstream", "ScenarioLinks",
        )

    def validate_links(self):
        with patch("src.data_interface.validation.load_schema", return_value=self.schema):
            return validate_table(
                RunContext("TestScenario"), "ScenarioUpstream", "ScenarioLinks",
                tables={"BaseHighwayLinks": self.base, "ScenarioLinks": self.links},
            )

    def test_added_links_are_allowed_without_json_exception(self):
        self.assertIs(self.validate_links(), self.links)
        # The two declarations still represent one relationship.
        joins = list(_joins(self.schema))
        self.assertEqual(len(joins), 1)
        self.assertEqual(joins[0][3], "IsAddedToBase")

    def test_unmarked_links_still_require_base_records(self):
        for added in (False, pd.NA):
            with self.subTest(added=added):
                self.links.loc["new", "is_added_to_base"] = added
                with self.assertRaisesRegex(ValueError, "IDs not found in BaseHighwayLinks"):
                    self.validate_links()

    def test_added_links_still_require_unique_ids(self):
        self.links = pd.concat([self.links, self.links.loc[["new"]]])
        with self.assertRaisesRegex(ValueError, "PK LinkID must be unique"):
            self.validate_links()


if __name__ == "__main__":
    unittest.main()
