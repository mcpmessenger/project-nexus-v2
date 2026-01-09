import subprocess
import json
import sys
import time
import os

def test_stdio_server():
    print("Starting server process...")
    # Add the site-packages path if needed, though 'python -m main' should work if pip installed
    cmd = [sys.executable, "-m", "main", "--transport", "stdio"]
    
    try:
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=0  # Unbuffered
        )
        
        print(f"Server started with PID: {process.pid}")
        
        # Give it a moment to initialize
        time.sleep(1)
        
        # Check if it crashed immediately
        if process.poll() is not None:
            stdout, stderr = process.communicate()
            print(f"Server crashed immediately with code {process.returncode}")
            print(f"STDOUT: {stdout}")
            print(f"STDERR: {stderr}")
            return

        # Send initialize request
        init_req = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test-client", "version": "1.0"}
            }
        }
        
        print(f"Sending request: {json.dumps(init_req)}")
        process.stdin.write(json.dumps(init_req) + "\n")
        process.stdin.flush()
        
        # Read response
        print("Waiting for response...")
        stdout_line = process.stdout.readline()
        print(f"Received: {stdout_line}")
        
        # Check stderr for debug info
        # Note: readline on stderr might block if no data, so strictly we should use threads or select,
        # but for a quick test checking stdout is primary.
        
        process.terminate()
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
            
    except Exception as e:
        print(f"Error running test: {e}")

if __name__ == "__main__":
    test_stdio_server()
