"""Named lookup functions; each implementation lives in its own module."""

from collections.abc import Callable
from importlib import import_module

LOOKUPS: dict[str, str] = {}


def get_lookup(name: str) -> Callable[..., object]:
    """Return a callable lookup by name; unknown names raise KeyError.

    Call the returned function with its declared inputs. Unfinished lookups
    raise NotImplementedError until their processing has been implemented.
    """
    return import_module(f".{LOOKUPS[name]}", __name__).lookup


# ID: lookup-0c219aa1-bb45-4716-93fa-9b1cac6a420f
LOOKUPS.setdefault('LevelOfMobilityLookup', 'level_of_mobility_lookup')


# ID: lookup-d2f2bd63-efb4-44db-bc75-5728d334f6c1
LOOKUPS.setdefault('CRFFactor', 'crf_factor')


# ID: lookup-8d80d870-2dc2-4aa0-89de-c0ef43eb9619
LOOKUPS.setdefault('DelayReductionFactorLookup', 'delay_reduction_factor_lookup')


# ID: lookup-b11c0c24-824c-4a5f-96ac-7da6cac8899e
LOOKUPS.setdefault('RunningEmissionFactor', 'running_emission_factor')


# ID: lookup-34e88095-4662-42f1-ac46-1119d149f945
LOOKUPS.setdefault('HDTExtraIdlingEmissionFactor', 'hdt_extra_idling_emission_factor')


# ID: lookup-09cf50fd-c9ea-484a-baef-09f4fe8fdbca
LOOKUPS.setdefault('VehicleStartEmissionFactor', 'vehicle_start_emission_factor')


# ID: lookup-07bcc5ba-2bfa-45cd-b0e4-c29a58133f08
LOOKUPS.setdefault('IdlingEmissionFactorLookup', 'idling_emission_factor_lookup')




# ID: lookup-9f2646b5-83a1-4d03-ac9b-9d1521f6ed37
LOOKUPS.setdefault('MilesperGallonLookup', 'milesper_gallon_lookup')


# ID: lookup-b5427b67-2e53-4cad-9909-5f6cc01a70fe
LOOKUPS.setdefault('kWhper100MileLookup', 'k_whper100_mile_lookup')


# ID: lookup-084f2fba-23b3-43de-93a4-81bc0c84846d
LOOKUPS.setdefault('FuelBTUPerGallonLookup', 'fuel_btu_per_gallon_lookup')




# ID: lookup-a9fd872a-e50f-48d8-a6da-312a8acab59b
LOOKUPS.setdefault('CrashMonetizationLookup', 'crash_monetization_lookup')


# ID: lookup-ca774c05-c0ac-4ba8-b046-5d0c5d3dda9f
LOOKUPS.setdefault('EmissionDamageDollarsLookup', 'emission_damage_dollars_lookup')
