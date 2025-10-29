#!/usr/bin/env python3
"""
Script to create scenario training and validation JSONL files with specific system instruction
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

def create_scenario_jsonl_files():
    """
    Create scenario training and validation JSONL files
    """
    
    # The specific system instruction provided
    system_instruction = """You are a scenario generator who adheres to real life dynamics while ensuring the generation of fun, witty, and smart scenarios. The scenarios must be realistic. Some examples of scenarios include: You're cycling in a narrow path and you see a herd of bulls charging at you.You wake up one day and see that your entire body is flakey.You are allergic to laughter and attending a stand up show.You want to keep your relationship private and the next door snitch finds out about it.You send a private photo in your family group chat and click on 'delete for me' instead of 'delete for everyone' by mistake.Your close mutual friends are dating in secret, they haven't told you and you just catch them in the act one day.Your roommate only answers in binary and you need to convince him/her for something.You feel an intense urge to sneeze but you've been holding in a fart in the middle of an important official meeting. You can't go to the washroom.Someone locked you in the washroom and you don't have your phone with you.You accidentally reply-all to an email complaining about your boss.Your headphones are tangled with your dog's leash and you're late for an important meeting.You try to cook spaghetti but the water boils over and floods the kitchen just as your date arrives.Your neighbor's parrot starts repeating your secrets loudly in the elevator.Your phone freezes while taking a selfie with a celebrity you accidentally met.You apply soap all over your body while taking a bath and water runs out.You're in the middle of a dance competition and realize that you have severe loose motion.You find a time bomb in your bag in the middle of a class with 10 seconds remaining.You're locked in a room with 20 dogs.You are a boy, the next day you find out that your entire wardrobe has been replaced with female clothes.On the day of a hair product photoshoot, you discover you've lost all your hair overnight.You're giving a presentation and realize your zipper has been down the entire time.You accidentally like your ex's photo from 3 years ago while stalking at 2 AM.You're at a funeral and your stomach growls louder than the eulogy.Your fake ID gets rejected at a club and the bouncer is your uncle.Generate a scenario"""
    
    # The user input prompt
    user_input = "Generate a scenario"
    
    try:
        # Read the scenario dataset CSV
        print("📖 Reading scenario_dataset.csv...")
        df = pd.read_csv('scenario_dataset.csv')
        print(f"✅ Loaded {len(df)} scenarios")
        print(f"Columns: {list(df.columns)}")
        
        # Check if we have the right column structure
        if 'scenario' not in df.columns:
            print("❌ Error: 'scenario' column not found in CSV")
            print(f"Available columns: {list(df.columns)}")
            return False
        
        # Extract scenarios
        scenarios = df['scenario'].tolist()
        print(f"📊 Total scenarios: {len(scenarios)}")
        
        # Create training examples
        training_examples = []
        for scenario in scenarios:
            if pd.notna(scenario) and len(str(scenario).strip()) > 0:
                google_format = create_google_ai_format(
                    system_instruction=system_instruction,
                    user_input=user_input,
                    assistant_output=str(scenario).strip()
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
        train_filename = "scenario_train.jsonl"
        with open(train_filename, 'w', encoding='utf-8') as f:
            for example in train_data:
                f.write(json.dumps(example, ensure_ascii=False) + '\n')
        
        print(f"✅ Created {train_filename}")
        
        # Write validation JSONL file
        val_filename = "scenario_val.jsonl"
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
            print("User Input:", sample["contents"][0]["parts"][0]["text"])
            print("Assistant Output:", sample["contents"][1]["parts"][0]["text"])
        
        return True
        
    except FileNotFoundError:
        print("❌ Error: scenario_dataset.csv not found")
        print("Please make sure the file exists in the current directory")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def main():
    """Main function"""
    print("🚀 Creating Scenario JSONL Files")
    print("=" * 60)
    
    success = create_scenario_jsonl_files()
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 Successfully created scenario JSONL files!")
        print("\nFiles created:")
        print("  📄 scenario_train.jsonl - Training data (80%)")
        print("  📄 scenario_val.jsonl - Validation data (20%)")
        print("\nFormat: Google AI training format with:")
        print("  - System instruction with examples")
        print("  - User input: 'Generate a scenario'")
        print("  - Assistant output: Individual scenarios")
    else:
        print("❌ Failed to create JSONL files")
        print("Please check the error messages above")

if __name__ == "__main__":
    main()