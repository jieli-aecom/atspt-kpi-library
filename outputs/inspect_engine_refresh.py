from pathlib import Path
import json
import pyarrow.parquet as pq

root = Path('C:/repos/compass-kpi-engine')
source = Path('C:/Users/lij11/OneDrive/OneDrive - AECOM/H-GAC ATSPT (Subs) - General/400_Technical/431_Task 1 Data Hub + Collection/4_Constants_Tables')
for name in ['base_highway_links.parquet', 'crashes.parquet']:
    path = source / name
    p = pq.ParquetFile(path)
    print(name, 'rows', p.metadata.num_rows, 'modified', path.stat().st_mtime)
    print(p.schema_arrow.remove_metadata())
    columns = [c for c in p.schema_arrow.names if c != 'geometry']
    df = pq.read_table(path, columns=columns).to_pandas()
    if name.startswith('base'):
        fields = [c for c in columns if any(s in c for s in ['class', 'type', 'section', 'srts', 'school', 'severity'])]
    else:
        fields = [c for c in columns if any(s in c for s in ['crash_type', 'intersection', 'cyclist', 'commercial', 'severity'])]
    for field in fields:
        print(field, df[field].dtype, 'missing', int(df[field].isna().sum()), 'values', df[field].value_counts(dropna=False).head(25).to_dict())
status = json.loads((root/'src/config/_status.json').read_text())
print('CURRENT STATUS', json.dumps({k:status.get(k) for k in ['BaseHighwayLinks','HistoricCrashes','ScenarioLinks']},indent=2))
