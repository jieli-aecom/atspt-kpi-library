from pathlib import Path
import json
import sys
import time
import nbformat
from nbclient import NotebookClient
from jupyter_client import KernelManager
from jupyter_client.kernelspec import KernelSpecManager

root = Path('C:/repos/compass-kpi-engine')
artifacts = Path('C:/repos/atspt-kpi-pool/outputs/engine-schema-refresh-20261109')
kernel_dir = artifacts / 'kernels' / 'engine-refresh'
kernel_dir.mkdir(parents=True, exist_ok=True)
(kernel_dir/'kernel.json').write_text(json.dumps({
    'argv': [sys.executable, '-m', 'ipykernel_launcher', '-f', '{connection_file}'],
    'display_name': 'KPI engine refresh verification', 'language': 'python'
}))
for name in ['create_temp_schema', 'test_schema']:
    path = root / 'notebooks' / (name + '.ipynb')
    nb = nbformat.read(path, as_version=4)
    sources = [cell.source for cell in nb.cells]
    original_kernel = dict(nb.metadata.kernelspec)
    # Generate the existing map, but avoid launching a browser during batch checks.
    bootstrap = nbformat.v4.new_code_cell('import webbrowser\nwebbrowser.open = lambda *args, **kwargs: False')
    nb.cells.insert(0, bootstrap)
    manager = KernelManager(kernel_name='engine-refresh', kernel_spec_manager=KernelSpecManager(kernel_dirs=[str(kernel_dir.parent)]))
    started = time.monotonic()
    def progress(cell, cell_index, **kwargs):
        print(f'{name} cell {cell_index - 1}: {cell.source.splitlines()[0][:100] if cell.source else ""}', flush=True)
    client = NotebookClient(nb, km=manager, timeout=600, resources={'metadata': {'path': str(root)}}, on_cell_start=progress)
    try:
        client.execute()
    except Exception:
        nb.cells.pop(0)
        nb.metadata.kernelspec = original_kernel
        nbformat.write(nb, artifacts / (name + '.failed.ipynb'))
        raise
    nb.cells.pop(0)
    nb.metadata.kernelspec = original_kernel
    assert [cell.source for cell in nb.cells] == sources
    assert not any(output.output_type == 'error' for cell in nb.cells if cell.cell_type == 'code' for output in cell.outputs)
    nbformat.validate(nb)
    nbformat.write(nb, path)
    print(f'{name}: all cells passed in {time.monotonic()-started:.1f}s', flush=True)
print('Both notebooks executed successfully; saved their refreshed outputs.', flush=True)
