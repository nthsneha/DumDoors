#!/usr/bin/env python3
"""
Script to verify the created JSONL files
"""

import json
import os

def verify_jsonl_file(filename):
    """Verify a JSONL file format and content"""
    print(f"\n🔍 Verifying {filename}")
    print("-" * 40)
    
    if not os.path.exists(filename):
        print(f"❌ File {filename} does not exist")
        return False
    
    try:
        line_count = 0
        valid_lines = 0
        
        with open(filename, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line_count += 1
                line = line.strip()
                
                if not line:
                    continue
                
                try:
                    # Parse JSON
                    data = json.loads(line)
                    
                    # Verify structure
                    required_keys = ['systemInstruction', 'contents']
                    if all(key in data for key in required_keys):
                        # Verify systemInstruction structure
                        sys_inst = data['systemInstruction']
                        if (sys_inst.get('role') == 'system' and 
                            'parts' in sys_inst and 
                            len(sys_inst['parts']) > 0 and
                            'text' in sys_inst['parts'][0]):
                            
                            # Verify contents structure
                            contents = data['contents']
                            if (len(contents) == 2 and
                                contents[0].get('role') == 'user' and
                                contents[1].get('role') == 'model' and
                                'parts' in contents[0] and 'parts' in contents[1]):
                                
                                valid_lines += 1
                            else:
                                print(f"❌ Line {line_num}: Invalid contents structure")
                        else:
                            print(f"❌ Line {line_num}: Invalid systemInstruction structure")
                    else:
                        print(f"❌ Line {line_num}: Missing required keys")
                        
                except json.JSONDecodeError as e:
                    print(f"❌ Line {line_num}: JSON decode error - {e}")
        
        print(f"📊 Total lines: {line_count}")
        print(f"✅ Valid lines: {valid_lines}")
        print(f"📈 Success rate: {valid_lines/line_count*100:.1f}%")
        
        if valid_lines == line_count:
            print(f"🎉 {filename} is perfectly formatted!")
            
            # Show sample content
            with open(filename, 'r', encoding='utf-8') as f:
                first_line = f.readline().strip()
                sample = json.loads(first_line)
                
                print(f"\n📋 Sample content:")
                print(f"System instruction length: {len(sample['systemInstruction']['parts'][0]['text'])} chars")
                print(f"User input: '{sample['contents'][0]['parts'][0]['text']}'")
                print(f"Model output: '{sample['contents'][1]['parts'][0]['text'][:100]}{'...' if len(sample['contents'][1]['parts'][0]['text']) > 100 else ''}'")
            
            return True
        else:
            print(f"⚠️ {filename} has formatting issues")
            return False
            
    except Exception as e:
        print(f"❌ Error reading {filename}: {e}")
        return False

def main():
    """Main verification function"""
    print("🔍 JSONL File Verification")
    print("=" * 50)
    
    files_to_verify = [
        "scenario_train.jsonl",
        "scenario_val.jsonl",
        "reasoning_train.jsonl",
        "reasoning_val.jsonl"
    ]
    
    all_valid = True
    
    for filename in files_to_verify:
        is_valid = verify_jsonl_file(filename)
        all_valid = all_valid and is_valid
    
    print("\n" + "=" * 50)
    if all_valid:
        print("🎉 All JSONL files are valid and properly formatted!")
        print("\n✅ Ready for training with Google AI Platform")
        print("\nFile summary:")
        for filename in files_to_verify:
            if os.path.exists(filename):
                size = os.path.getsize(filename)
                with open(filename, 'r') as f:
                    lines = sum(1 for _ in f)
                print(f"  📄 {filename}: {lines} examples, {size:,} bytes")
    else:
        print("❌ Some files have issues. Please check the errors above.")

if __name__ == "__main__":
    main()