#!/usr/bin/env python3
import re

# Read the file
with open('src/data/urls/spotifyUrls.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Split into lines
lines = content.splitlines(keepends=True)

# Find where to start (after id: 490)
last_formatted_idx = None
for i, line in enumerate(lines):
    if 'id: 490,' in line:
        # Find the closing brace of this entry
        for j in range(i, min(i+5, len(lines))):
            if '},'.strip() in lines[j]:
                last_formatted_idx = j
                break
        break

if last_formatted_idx is None:
    print("Could not find last formatted entry")
    exit(1)

# Collect all the unformatted songs
unformatted_start = last_formatted_idx + 1
unformatted_text = ''.join(lines[unformatted_start:])

# Find where the comments start
comment_start = unformatted_text.find('  // Roc Boys')
if comment_start == -1:
    comment_start = unformatted_text.find('// Roc Boys')

if comment_start != -1:
    songs_text = unformatted_text[:comment_start]
    comments = unformatted_text[comment_start:]
else:
    songs_text = unformatted_text
    comments = ''

# Parse the songs - split by double newlines and process pairs
# Remove leading/trailing whitespace
songs_text = songs_text.strip()

# Split into lines and process
lines_to_process = songs_text.split('\n')
formatted_songs = []
current_id = 491

i = 0
while i < len(lines_to_process):
    line = lines_to_process[i].strip()
    
    # Skip empty lines
    if not line:
        i += 1
        continue
    
    # If this looks like a URL, skip it (it's orphaned)
    if line.startswith('https://'):
        i += 1
        continue
    
    # This should be a title
    title = line
    i += 1
    
    # Skip any empty lines
    while i < len(lines_to_process) and not lines_to_process[i].strip():
        i += 1
    
    # Get the URL
    if i < len(lines_to_process):
        url = lines_to_process[i].strip()
        if url.startswith('https://'):
            formatted_songs.append(f'  {{\n')
            formatted_songs.append(f'    id: {current_id}, // {title}\n')
            formatted_songs.append(f'    url: "{url}",\n')
            formatted_songs.append(f'  }},\n')
            current_id += 1
        i += 1

# Reconstruct the file
new_content = ''.join(lines[:last_formatted_idx+1])
new_content += ''.join(formatted_songs)
new_content += comments

# Write back
with open('src/data/urls/spotifyUrls.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Successfully formatted {current_id - 491} songs (IDs 491-{current_id-1})")
