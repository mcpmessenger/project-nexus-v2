import sys
import os
import socket
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("debug_imports")

print(f"Python Version: {sys.version}")
print(f"CWD: {os.getcwd()}")
print(f"sys.path: {sys.path}")

modules_to_test = [
    "auth.oauth_config",
    "core.server",
    "core.utils",
    "gmail.gmail_tools",
    "fastmcp"
]

for mod in modules_to_test:
    try:
        from importlib import import_module
        import_module(mod)
        print(f"✅ Successfully imported {mod}")
    except Exception as e:
        print(f"❌ Failed to import {mod}: {e}")

# Test port 54321
port = 54321
try:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("localhost", port))
    print(f"✅ Port {port} is available")
except Exception as e:
    print(f"❌ Port {port} is unavailable: {e}")

# Check for .env.local
env_local = os.path.join(os.getcwd(), ".env.local")
if os.path.exists(env_local):
    print(f"✅ .env.local exists at {env_local}")
    from dotenv import load_dotenv
    load_dotenv(env_local)
    print(f"   GOOGLE_OAUTH_CLIENT_ID: {'SET' if os.getenv('GOOGLE_OAUTH_CLIENT_ID') else 'NOT SET'}")
else:
    print(f"❌ .env.local MISSING at {env_local}")
