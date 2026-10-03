# flask.spec
# Builds the Flask backend as a headless executable.
# Output is packaged into dist/flask/ which electron-builder includes as extraResources.

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

docx_datas = collect_data_files('docx')
docx_hidden = collect_submodules('docx')
pypdf_datas = collect_data_files('pypdf')
pypdf_hidden = collect_submodules('pypdf')

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('templates', 'templates'),
        ('static',    'static'),
        ('version.json', '.'),
    ] + docx_datas + pypdf_datas,
    hiddenimports=[
        'plyer.platforms.win.notification',
        'sqlite3',
        'rag',
        'rag.parsers',
        'rag.chunker',
        'rag.engine',
        'tools',
        'tools.document_generator',
        'tools.summarizer',
        'llm',
        'llm.gateway',
    ] + docx_hidden + pypdf_hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
    ],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='flask',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,    # headless — no console window
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='flask',     # output folder: dist/flask/
)
