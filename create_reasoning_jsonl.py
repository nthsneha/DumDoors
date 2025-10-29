#!/usr/bin/env python3
"""
Script to create reasoning training and validation JSONL files
"""

import pandas as pd
import json
import os
from sklearn.model_selection import train_test_split
from typing import Dict, Any

def create_google_ai_format(system_instruction: str, user_input: str, assistant_output: str) -> Dict[str, Any]:
    """
    Create a single training example in Google AI format
    """
    return {
        "systemInstruction": {
            "role": "system",
            "parts": [
                {
                    "text": system_instruction
                }
            ]
        },
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": user_input
                    }
                ]
            },
            {
                "role": "model",
                "parts": [
                    {
                        "text": assistant_output
                    }
                ]
            }
        ]
    }

def create_reasoning_jsonl_files():
    """
    Create reasoning training and validation JSONL files
    """
    
    # System instruction for reasoning evaluation
    system_instruction = """You are an AI assistant that provides reasoning for decision-making scenarios. For each scenario, you analyze the worst possible decision and the best possible decision, explaining the potential outcomes in a humorous but realistic way. Your responses should follow the format: 'WORST decision/move: [explanation with exaggerated negative outcome]. BEST decision/move: [explanation with practical solution]. [Additional context about outcomes comparing the two approaches].' Be witty, entertaining, and educational while maintaining realism."""
    
    try:
        # Read the reasoning dataset CSV
        print("📖 Reading reasoning_dataset.csv...")
        df = pd.read_csv('reasoning_dataset.csv')
        print(f"✅ Loaded {len(df)} reasoning examples")
        print(f"Columns: {list(df.columns)}")
        
        # Check if we have the right column structure
        if 'scenario' not in df.columns or 'reasoning' not in df.columns:
            print("❌ Error: Required columns 'scenario' and 'reasoning' not found in CSV")
            print(f"Available columns: {list(df.columns)}")
            return False
        
        # Create training examples
        training_examples = []
        for _, row in df.iterrows():
            scenario = row['scenario']
            reasoning = row['reasoning']
            
            if (pd.notna(scenario) and pd.notna(reasoning) and 
                len(str(scenario).strip()) > 0 and len(str(reasoning).strip()) > 0):
                
                # Create user input with the scenario
                user_input = f"Analyze this scenario and provide reasoning for the best and worst decisions: {str(scenario).strip()}"
                
                google_format = create_google_ai_format(
                    system_instruction=system_instruction,
                    user_input=user_input,
                    assistant_output=str(reasoning).strip()
                )
                training_examples.append(google_format)
        
        print(f"📝 Created {len(training_examples)} training examples")
        
        # Split into 80/20 train/validation
        train_data, val_data = train_test_split(
            training_examples, 
            test_size=0.2, 
            random_state=42
        )
        
        print(f"🔄 Split data:")
        print(f"  Training: {len(train_data)} examples")
        print(f"  Validation: {len(val_data)} examples")
        
        # Write training JSONL file
        train_filename = "reasoning_train.jsonl"
        with open(train_filename, 'w', encoding='utf-8') as f:
            for example in train_data:
                f.write(json.dumps(example, ensure_ascii=False) + '\n')
        
        print(f"✅ Created {train_filename}")
        
        # Write validation JSONL file
        val_filename = "reasoning_val.jsonl"
        with open(val_filename, 'w', encoding='utf-8') as f:
            for example in val_data:
                f.write(json.dumps(example, ensure_ascii=False) + '\n')
        
        print(f"✅ Created {val_filename}")
        
        # Show file sizes
        train_size = os.path.getsize(train_filename)
        val_size = os.path.getsize(val_filename)
        print(f"📄 File sizes:")
        print(f"  {train_filename}: {train_size:,} bytes")
        print(f"  {val_filename}: {val_size:,} bytes")
        
        # Show sample from training file
        print(f"\n📋 Sample from {train_filename}:")
        print("-" * 50)
        if train_data:
            sample = train_data[0]
            print("System Instruction:", sample["systemInstruction"]["parts"][0]["text"][:100] + "...")
            print("User Input:", sample["contents"][0]["parts"][0]["text"][:100] + "...")
            print("Assistant Output:", sample["contents"][1]["parts"][0]["text"][:150] + "...")
        
        return True
        
    except FileNotFoundError:
        print("❌ Error: reasoning_dataset.csv not found")
        print("Please make sure the file exists in the current directory")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def main():
    """Main function"""
    print("🚀 Creating Reasoning JSONL Files")
    print("=" * 60)
    
    success = create_reasoning_jsonl_files()
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 Successfully created reasoning JSONL files!")
        print("\nFiles created:")
        print("  📄 reasoning_train.jsonl - Training data (80%)")
        print("  📄 reasoning_val.jsonl - Validation data (20%)")
        print("\nFormat: Google AI training format with:")
        print("  - System instruction for reasoning analysis")
        print("  - User input: 'Analyze this scenario and provide reasoning...'")
        print("  - Assistant output: WORST/BEST decision analysis")
    else:
        print("❌ Failed to create JSONL files")
        print("Please check the error messages above")

if __name__ == "__main__":
    main()