#!/usr/bin/env python3
"""
Script to transform dataset.csv into a new format with two columns:
- input: Contains the prompt for scenario generation
- scenario: Contains the scenarios from the original dataset
"""

import csv
import pandas as pd

def create_transformed_dataset():
    # The input prompt template
    input_prompt = """You are a scenario generator who adheres to real life dynamics while ensuring the generation of fun, witty, and smart scenarios. The scenarios must be realistic. Some examples of scenarios include: You're cycling in a narrow path and you see a herd of bulls charging at you.You wake up one day and see that your entire body is flakey.You are allergic to laughter and attending a stand up show.You want to keep your relationship private and the next door snitch finds out about it.You send a private photo in your family group chat and click on 'delete for me' instead of 'delete for everyone' by mistake.Your close mutual friends are dating in secret, they haven't told you and you just catch them in the act one day.Your roommate only answers in binary and you need to convince him/her for something.You feel an intense urge to sneeze but you've been holding in a fart in the middle of an important official meeting. You can't go to the washroom.Someone locked you in the washroom and you don't have your phone with you.You accidentally reply-all to an email complaining about your boss.Your headphones are tangled with your dog's leash and you're late for an important meeting.You try to cook spaghetti but the water boils over and floods the kitchen just as your date arrives.Your neighbor's parrot starts repeating your secrets loudly in the elevator.Your phone freezes while taking a selfie with a celebrity you accidentally met.You apply soap all over your body while taking a bath and water runs out.You're in the middle of a dance competition and realize that you have severe loose motion.You find a time bomb in your bag in the middle of a class with 10 seconds remaining.You're locked in a room with 20 dogs.You are a boy, the next day you find out that your entire wardrobe has been replaced with female clothes.On the day of a hair product photoshoot, you discover you've lost all your hair overnight.You're giving a presentation and realize your zipper has been down the entire time.You accidentally like your ex's photo from 3 years ago while stalking at 2 AM.You're at a funeral and your stomach growls louder than the eulogy.Your fake ID gets rejected at a club and the bouncer is your uncle.Generate a scenario"""
    
    # Read the original dataset
    try:
        df = pd.read_csv('dataset.csv')
        print(f"Successfully loaded dataset with {len(df)} rows")
        
        # Create new dataframe with the required structure
        new_data = []
        
        for index, row in df.iterrows():
            scenario = row['scenario']
            new_data.append({
                'input': input_prompt,
                'scenario': scenario
            })
        
        # Create new dataframe
        new_df = pd.DataFrame(new_data)
        
        # Save to new CSV file
        output_filename = 'transformed_dataset.csv'
        new_df.to_csv(output_filename, index=False, quoting=csv.QUOTE_ALL)
        
        print(f"Successfully created {output_filename} with {len(new_df)} rows")
        print(f"Columns: {list(new_df.columns)}")
        print("\nFirst few rows preview:")
        print("=" * 50)
        for i in range(min(3, len(new_df))):
            print(f"Row {i+1}:")
            print(f"Input: {new_df.iloc[i]['input'][:100]}...")
            print(f"Scenario: {new_df.iloc[i]['scenario']}")
            print("-" * 30)
            
    except FileNotFoundError:
        print("Error: dataset.csv file not found in the current directory")
    except Exception as e:
        print(f"Error processing the dataset: {str(e)}")

if __name__ == "__main__":
    create_transformed_dataset()