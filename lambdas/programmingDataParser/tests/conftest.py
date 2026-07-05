import os
import sys
from pathlib import Path

# boto3 initializes clients/resources at module import time.
# Provide dummy values so it doesn't raise NoRegionError / NoCredentialsError
# before the per-test patches are in place.
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
