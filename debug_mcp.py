import subprocess
import json
import sys
import os
import time

def run_diagnostic():
    print("--- DIAGNOSTIC START ---")
    
    # Environment with some dummy creds just in case, but relying on defaults
    env = os.environ.copy()
    
    # Command matching the app's config
    cmd = [sys.executable, "-m", "main", "--transport", "stdio"]
    
    print(f"Executing: {' '.join(cmd)}")
    
    try:
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=r"c:\Users\senti\OneDrive\Desktop\project-nexus-v2\project-nexus-v2-main"
        )
        
        # Send initialization request
        # MCP requires initialize first? usually yes.
        init_req = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "diag", "version": "1.0"}
            }
        }
        
        # Send tools/list request
        list_req = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }
        
        stdin_input = json.dumps(init_req) + "\n" + json.dumps(list_req) + "\n"
        
        print("Sending input...")
        stdout, stderr = process.communicate(input=stdin_input, timeout=10)
        
        print("\n--- STDOUT ---")
        print(f"'{stdout}'")
        print("--- END STDOUT ---")
        
        print("\n--- STDERR ---")
        print(f"'{stderr}'")
        print("--- END STDERR ---")
        
        print(f"\nExit code: {process.returncode}")
        
    except Exception as e:
        print(f"\nERROR: {e}")

if __name__ == "__main__":
    run_diagnostic()
