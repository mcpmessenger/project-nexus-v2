import subprocess
import json
import sys
import os

def run_test():
    cmd = [sys.executable, "-m", "main", "--transport", "stdio"]
    try:
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=r"c:\Users\senti\OneDrive\Desktop\project-nexus-v2\project-nexus-v2-main"
        )
        
        # Send ONLY tools/list request (no initialize)
        list_req = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list",
            "params": {}
        }
        
        stdout, stderr = process.communicate(input=json.dumps(list_req) + "\n", timeout=10)
        print(f"STDOUT: {stdout}")
        print(f"STDERR: {stderr}")
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    run_test()
