#!/usr/bin/env python3
import re

def escape_quotes(text):
    """Escape double quotes in a string"""
    return text.replace('"', '\\"')

# Read the file
with open('src/data/urls/spotifyUrls.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to match entries with title and artists fields
# Match: title: "Some Title",
# We need to find titles that contain unescaped quotes and escape them

# First, let's find all title values
def fix_title_quotes(match):
    """Fix quotes within title strings"""
    full_match = match.group(0)
    title_content = match.group(1)
    
    # If the title already has escaped quotes, don't double-escape
    if '\\"' in title_content:
        return full_match
    
    # Escape any unescaped quotes
    fixed_title = title_content.replace('"', '\\"')
    return f'title: "{fixed_title}",'

# Match: title: "anything",
# The pattern captures the content between the quotes
pattern = r'title: "([^"]*(?:"[^"]*)*)",'

# This won't work for quotes inside. Let's use a different approach.
# Find all occurrences of title: "..." and fix them

lines = content.split('\n')
fixed_lines = []

for line in lines:
    # Check if this line contains a title field
    if 'title: "' in line and not '\\"' in line:
        # Extract the part after title: "
        start_idx = line.find('title: "') + len('title: "')
        # Find the closing ",
        end_idx = line.rfind('",')
        
        if end_idx > start_idx:
            title_content = line[start_idx:end_idx]
            # Check if there's a quote in the middle (like 7")
            if '"' in title_content:
                # Escape it
                fixed_title = title_content.replace('"', '\\"')
                line = line[:start_idx] + fixed_title + line[end_idx:]
    
    fixed_lines.append(line)

new_content = '\n'.join(fixed_lines)

# Write back
with open('src/data/urls/spotifyUrls.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully fixed quote escaping in titles!")


