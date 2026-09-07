#!/usr/bin/env python3
import sys, os, textwrap
from PIL import Image, ImageDraw, ImageFont

FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_REG  = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
W, H = 512, 512
PAD  = 36
COLORS = {
    'bg':     (14, 14, 26, 255),
    'accent': (88, 166, 255, 255),
    'name':   (88, 166, 255, 255),
    'quote':  (230, 230, 235, 255),
    'bar':    (88, 166, 255, 255),
    'marks':  (255, 255, 255, 40),
    'footer': (120, 120, 140, 255),
}

def wrap_text(text, font, draw, max_width):
    words = text.split()
    lines, line = [], ''
    for word in words:
        test = (line + ' ' + word).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] <= max_width:
            line = test
        else:
            if line: lines.append(line)
            line = word
    if line: lines.append(line)
    return lines

def generate(sender_name, quote_text, output_path):
    img  = Image.new('RGBA', (W, H), COLORS['bg'])
    draw = ImageDraw.Draw(img)
    corner = 32
    for x in range(corner):
        for y in range(corner):
            if ((corner-x)**2 + (corner-y)**2)**0.5 > corner:
                for cx, cy in [(x,y),(W-1-x,y),(x,H-1-y),(W-1-x,H-1-y)]:
                    img.putpixel((cx, cy), (0,0,0,0))
    draw.rectangle([PAD, PAD, PAD+5, H-PAD], fill=COLORS['bar'])
    try:
        fnt_marks = ImageFont.truetype(FONT_BOLD, 160)
        draw.text((PAD+20, PAD-30), '\u201c', font=fnt_marks, fill=COLORS['marks'])
    except: pass
    fnt_name = ImageFont.truetype(FONT_BOLD, 26)
    name_display = sender_name[:28] + ('...' if len(sender_name) > 28 else '')
    draw.text((PAD+18, PAD+8), name_display, font=fnt_name, fill=COLORS['name'])
    name_bbox = draw.textbbox((0,0), name_display, font=fnt_name)
    div_y = PAD + (name_bbox[3]-name_bbox[1]) + 16
    draw.line([(PAD+18, div_y), (W-PAD, div_y)], fill=(88,166,255,60), width=1)
    text_x = PAD + 18
    text_y = div_y + 14
    max_text_w = W - text_x - PAD
    max_text_h = H - text_y - PAD - 40

    # Font size scales WITH text length - short text = BIG letters
    char_count = len(quote_text.strip())
    if char_count <= 15:
        size_candidates = [80, 70, 60, 52, 44, 36, 30]
    elif char_count <= 30:
        size_candidates = [52, 44, 36, 30, 26, 22]
    elif char_count <= 60:
        size_candidates = [36, 30, 26, 22, 19]
    elif char_count <= 100:
        size_candidates = [26, 22, 19, 17, 15]
    elif char_count <= 180:
        size_candidates = [20, 17, 15, 13]
    else:
        size_candidates = [16, 14, 12, 11]

    for size in size_candidates:
        fnt_quote = ImageFont.truetype(FONT_REG, size)
        lines = wrap_text(quote_text, fnt_quote, draw, max_text_w)
        line_h = draw.textbbox((0,0),'Ag', font=fnt_quote)[3] + 6
        if len(lines) * line_h <= max_text_h: break
    cy = text_y
    for line in lines:
        if cy + line_h > H - PAD - 30:
            draw.text((text_x, cy), '...', font=fnt_quote, fill=COLORS['quote']); break
        draw.text((text_x, cy), line, font=fnt_quote, fill=COLORS['quote'])
        cy += line_h
    fnt_footer = ImageFont.truetype(FONT_REG, 15)
    draw.text((PAD+18, H-PAD-2), 'via QuoteBot \u2726', font=fnt_footer, fill=COLORS['footer'])
    img.save(output_path, 'WEBP', quality=92)
    print(f'OK:{output_path}')

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print('Usage: script.py <name> <text> <outpath>'); sys.exit(1)
    generate(sys.argv[1], sys.argv[2], sys.argv[3])
