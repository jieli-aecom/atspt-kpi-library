from pathlib import Path
import hashlib
import ast
import json
import sys
import nbformat
import pandas as pd
from nbconvert import HTMLExporter

root = Path('C:/repos/compass-kpi-engine')
sys.path.insert(0, str(root))
from src.data_interface import loader
from src.data_interface.staging import stage_fields, field_status
from src.data_interface.validation import validate_table
from src.pipeline.context import RunContext

artifacts = Path('C:/repos/atspt-kpi-pool/outputs/engine-schema-refresh-20261109')
context = RunContext('TestScenario')
source = Path('C:/Users/lij11/OneDrive/OneDrive - AECOM/H-GAC ATSPT (Subs) - General/400_Technical/431_Task 1 Data Hub + Collection/4_Constants_Tables')
status = json.loads((root/'src/config/_status.json').read_text())
crashes = validate_table(context, 'PreprocessedConstants', 'HistoricCrashes')
raw = pd.read_parquet(source/'crashes.parquet', columns=['crash_point_id','crash_type_intersection','crash_type_ped_cyclist']).set_index('crash_point_id')
assert crashes.index.equals(raw.index)
assert 'type' not in crashes
for field, original in [('is_intersection','crash_type_intersection'),('involves_pedestrian_cyclist','crash_type_ped_cyclist')]:
    pd.testing.assert_series_equal(crashes[field], raw[original].astype('boolean'), check_names=False)
    assert field in status['HistoricCrashes']['completed_fields']
assert all('type' not in fields for fields in status['HistoricCrashes'].values())
overlap = int((crashes.is_intersection & crashes.involves_pedestrian_cyclist).sum())
assert overlap == int((raw.crash_type_intersection & raw.crash_type_ped_cyclist).sum())

base = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
raw_base = pd.read_parquet(source/'base_highway_links.parquet', columns=['link_id','roadway_class']).set_index('link_id')
expected = raw_base.roadway_class.replace({'FringeRural':'Fringe Rural','L2+3_Suburban':'L2 L3 Suburban','L4+5_Suburban':'L4 L5 Suburban','UrbanCore':'Urban Core'})
pd.testing.assert_series_equal(base.base_year_roadway_class, expected, check_names=False)
missing = round(float(expected.isna().mean()*100),4)
assert status['BaseHighwayLinks']['fields_with_missing_values']['base_year_roadway_class'] == missing
assert 'base_year_roadway_class' not in status['BaseHighwayLinks']['problematic_fields']

# Regression: overlap and unknown flags must remain independent through staging/status.
flags = pd.DataFrame({'is_intersection':pd.array([True,False,None],dtype='boolean'),
                      'involves_pedestrian_cyclist':pd.array([True,True,None],dtype='boolean')},
                     index=pd.Index(['a','b','c'],name='crash_point_id'))
staged = stage_fields(flags,'PreprocessedConstants','HistoricCrashes')
for field in flags:
    pd.testing.assert_series_equal(staged[field],flags[field])
assert 'type' not in staged
fixture_status = field_status(staged,'PreprocessedConstants','HistoricCrashes')
assert fixture_status['fields_with_missing_values']['is_intersection'] == 33.3333
assert fixture_status['fields_with_missing_values']['involves_pedestrian_cyclist'] == 33.3333

implemented=json.loads((artifacts/'implemented-before.json').read_text())
for relative,digest in implemented.items():
    if Path(relative).name == '__init__.py':
        # Initiation refreshes generated lookup registrations; preserve function bodies.
        def functions(path):
            return [ast.dump(node) for node in ast.parse(path.read_text()).body
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))]
        assert functions(root/relative) == functions(artifacts/'before'/relative), relative
        continue
    assert hashlib.sha256((root/relative).read_bytes()).hexdigest()==digest, relative
for name in ['library-schema.json','table-schema.json']:
    assert (root/'src/config'/name).read_bytes()==(artifacts/'before/src/config'/name).read_bytes()

for name,allowed in [('create_temp_schema',{7,12,13,25}),('test_schema',{5,8,9})]:
    path=root/'notebooks'/f'{name}.ipynb'
    nb=nbformat.read(path,as_version=4)
    previous=nbformat.read(artifacts/'before/notebooks'/f'{name}.ipynb',as_version=4)
    assert len(nb.cells)==len(previous.cells)
    for i,(cell,old) in enumerate(zip(nb.cells,previous.cells)):
        assert cell.cell_type==old.cell_type
        if i not in allowed: assert cell.source==old.source,(name,i)
        if cell.cell_type=='code':
            assert cell.execution_count is not None,(name,i)
            assert not any(o.output_type=='error' for o in cell.outputs),(name,i)
    assert nb.cells[0].source.startswith('%reload_ext autoreload\n%autoreload 2')
    nbformat.validate(nb)
    if name=='test_schema':
        # Use the saved outputs directly for visual inspection; do not rerun calculations.
        preview=nbformat.v4.new_notebook(cells=[nb.cells[i] for i in [5,9]],metadata=nb.metadata)
        exporter=HTMLExporter()
        exporter.exclude_input=True
        body,_=exporter.from_notebook_node(preview)
        (artifacts/'schema-display-preview.html').write_text(body,encoding='utf8')
result={'crash_rows':len(crashes),'overlapping_flags_retained':overlap,'highway_rows':len(base),
        'roadway_class_missing_percent':missing,'implemented_files_preserved':len(implemented),
        'notebooks_executed':['create_temp_schema','test_schema'],'schema_exports_preserved':True,
        'checks':'field/type/key/join validation, raw-to-staged equality, nullable flags, current status, notebook preservation'}
(artifacts/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
