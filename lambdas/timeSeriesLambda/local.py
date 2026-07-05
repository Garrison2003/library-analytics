import io
import os
import unittest.mock as mock
from lambda_handler import handler

# LOCAL_DIR = r"C:\Users\Garrison\Downloads"
# LOCAL_FILES = [
#     "FY2023 Circulation Statistics.xlsm",
#     "FY2024 Circulation Statistics.xlsm",
#     "FY2025 Circulation Statistics.xlsm",
#     "FY2026 Circulation Statistics.xlsm",
# ]


# def _local_list(*_):
#     return [f for f in LOCAL_FILES if os.path.exists(os.path.join(LOCAL_DIR, f))]


# def _local_download(_, key):
#     path = os.path.join(LOCAL_DIR, os.path.basename(key))
#     with open(path, "rb") as f:
#         return io.BytesIO(f.read())


if __name__ == "__main__":
    test_event = {"department": "Imaginon"}
    test_context = {}

    # with mock.patch("lambda_handler.list_xlsm_files", side_effect=_local_list), \
    #      mock.patch("lambda_handler.download_s3_file", side_effect=_local_download):
    handler(test_event, test_context)
