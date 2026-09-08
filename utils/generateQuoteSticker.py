#!/usr/bin/env python3
import sys, os, textwrap, unicodedata
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

def normalize_text(text):
    if not text:
        return ""
    # Normalize mathematical/gothic/fancy unicode characters to standard glyphs
    res = []
    for char in text:
        cp = ord(char)
        if 0x1D400 <= cp <= 0x1D419: res.append(chr(ord('A') + (cp - 0x1D400)))
        elif 0x1D41A <= cp <= 0x1D433: res.append(chr(ord('a') + (cp - 0x1D41A)))
        elif 0x1D434 <= cp <= 0x1D44D: res.append(chr(ord('A') + (cp - 0x1D434)))
        elif 0x1D44E <= cp <= 0x1D467: res.append(chr(ord('a') + (cp - 0x1D44E)))
        elif 0x1D468 <= cp <= 0x1D481: res.append(chr(ord('A') + (cp - 0x1D468)))
        elif 0x1D482 <= cp <= 0x1D49B: res.append(chr(ord('a') + (cp - 0x1D482)))
        elif 0x1D5A0 <= cp <= 0x1D5B9: res.append(chr(ord('A') + (cp - 0x1D5A0)))
        elif 0x1D5BA <= cp <= 0x1D5D3: res.append(chr(ord('a') + (cp - 0x1D5BA)))
        elif 0xFF21 <= cp <= 0xFF3A: res.append(chr(ord('A') + (cp - 0xFF21)))
        elif 0xFF41 <= cp <= 0xFF5A: res.append(chr(ord('a') + (cp - 0xFF41)))
        else: res.append(char)
    cleaned = ''.join(res)
    return unicodedata.normalize('NFKD', cleaned)

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

def load_circular_avatar(avatar_path, size):
    """Load an image and crop it to a circle (transparent corners)."""
    try:
        if not avatar_path or not os.path.exists(avatar_path):
            return None
        av = Image.open(avatar_path).convert('RGBA')
        av = av.resize((size, size), Image.LANCZOS)
        mask = Image.new('L', (size, size), 0)
        d = ImageDraw.Draw(mask)
        d.ellipse((0, 0, size, size), fill=255)
        out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        out.paste(av, (0, 0), mask)
        return out
    except Exception as e:
        return None

def generate(sender_name, quote_text, output_path, avatar_path=None):
    sender_name = normalize_text(sender_name)
    quote_text = normalize_text(quote_text)

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

    # ── Header row: avatar (if available) + name ─────────────────────────────
    AV = 62
    AV_X = PAD + 18
    AV_Y = PAD + 8
    avatar = load_circular_avatar(avatar_path, AV) if avatar_path else None
    if avatar is not None:
        img.paste(avatar, (AV_X, AV_Y), avatar)

    fnt_name = ImageFont.truetype(FONT_BOLD, 26)
    name_display = sender_name[:28] + ('...' if len(sender_name) > 28 else '')
    name_x = AV_X + AV + 12 if avatar is not None else PAD + 18
    name_y = AV_Y + (AV // 2) - 8  # vertically center name against avatar
    draw.text((name_x, name_y), name_display, font=fnt_name, fill=COLORS['name'])

    name_bbox = draw.textbbox((0, 0), name_display, font=fnt_name)
    # Divider sits below whichever is taller: avatar or name text
    header_bottom = max(AV_Y + AV, name_y + name_bbox[3])
    div_y = header_bottom + 12
    draw.line([(PAD, div_y), (W-PAD, div_y)], fill=(88,166,255,60), width=1)

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

    lines = ['']
    line_h = 24
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
        print('Usage: script.py <name> <text> <outpath> [avatar_path]'); sys.exit(1)
    _av = sys.argv[4] if len(sys.argv) > 4 else None
    generate(sys.argv[1], sys.argv[2], sys.argv[3], _av)
