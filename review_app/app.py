from __future__ import annotations

import csv
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
from datetime import date
from pathlib import Path

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

BASE_DIR   = Path(__file__).parent.parent
OUTPUT_DIR = BASE_DIR / "output"

_MONTH_RE = re.compile(r'^\d{4}-\d{2}$')

WALLET_COLUMNS = [
    "account", "category", "currency", "amount", "ref_currency_amount",
    "type", "payment_type", "note", "payment_type_local", "date",
    "gps_latitude", "gps_longitude", "gps_accuracy_in_meters",
    "warranty_in_month", "transfer", "payee", "labels", "envelope_id",
    "custom_category",
]


def _read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def _available_months() -> list[str]:
    if not OUTPUT_DIR.exists():
        return []
    return sorted(
        p.stem
        for p in OUTPUT_DIR.glob("*.csv")
        if _MONTH_RE.match(p.stem)
    )


@app.route("/")
def index():
    return render_template(
        "index.html",
        months=_available_months(),
        default_month=date.today().strftime("%Y-%m"),
    )


@app.route("/months")
def get_months():
    return jsonify({"months": _available_months()})


@app.route("/run", methods=["POST"])
def run():
    month = request.form.get("month", "").strip()
    if not month:
        return jsonify({"error": "Month is required"}), 400

    tmpdir = tempfile.mkdtemp(prefix="finance_pipeline_")
    try:
        cmd = [sys.executable, str(BASE_DIR / "pipeline.py"), "--month", month]

        for tag in ("hlb", "ocbc", "rhb"):
            f = request.files.get(tag)
            if f and f.filename:
                ext  = Path(f.filename).suffix
                path = os.path.join(tmpdir, f"{tag}{ext}")
                f.save(path)
                cmd += [f"--{tag}", path]

        if len(cmd) == 4:
            return jsonify({"error": "Upload at least one tagged file"}), 400

        result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(BASE_DIR))
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    return jsonify({
        "ok":     result.returncode == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "month":  month,
    })


@app.route("/data/<month>")
def get_data(month: str):
    rows = _read_csv(OUTPUT_DIR / f"{month}.csv")
    return jsonify({"transactions": rows})


if __name__ == "__main__":
    def _open_browser():
        time.sleep(1.2)
        webbrowser.open("http://localhost:5000")

    threading.Thread(target=_open_browser, daemon=True).start()
    app.run(debug=False, port=5000)
