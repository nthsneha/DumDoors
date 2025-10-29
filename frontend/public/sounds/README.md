# Sound Effects for DumDoors

This directory should contain the following sound effect files:

## Required Sound Files:

1. **bad_door.mp3** - Plays when score ≤ 30 (poor performance)
2. **great_door.mp3** - Plays when score ≥ 70 (excellent performance)  
3. **okay.mp3** - Plays when score is between 30-70 (average performance)

## File Specifications:

- **Format**: MP3
- **Volume**: Files will be played at 50% volume
- **Duration**: Recommended 1-3 seconds for quick feedback
- **Quality**: 44.1kHz, 128kbps or higher

## Usage:

Sound effects are triggered automatically when a player submits a response and receives a score. The appropriate sound plays based on the score range:

- **Score 0-30**: bad_door.mp3 (disappointed/negative sound)
- **Score 31-69**: okay.mp3 (neutral/average sound)  
- **Score 70-100**: great_door.mp3 (celebratory/positive sound)

Players can toggle sound effects on/off using the 🔔/🔕 button in the game menu.