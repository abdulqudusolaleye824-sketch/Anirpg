#!/usr/bin/env python3
import sys, os, textwrap, unicodedata
from PIL import Image, ImageDraw, ImageFont

FONT_CJK_BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
FONT_CJK_REG  = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
FONT_DEJAVU_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_DEJAVU_REG  = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_EMOJI = '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf'

FONT_BOLD = FONT_CJK_BOLD if os.path.exists(FONT_CJK_BOLD) else FONT_DEJAVU_BOLD
FONT_REG  = FONT_CJK_REG  if os.path.exists(FONT_CJK_REG)  else FONT_DEJAVU_REG

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
    return unicodedata.normalize('NFC', cleaned)

def is_emoji(char):
    cp = ord(char)
    return (
        0x1F300 <= cp <= 0x1F9FF or
        0x1F600 <= cp <= 0x1F64F or
        0x1F680 <= cp <= 0x1F6FF or
        0x2600  <= cp <= 0x27BF or
        0x1F1E6 <= cp <= 0x1F1FF or
        0xFE00  <= cp <= 0xFE0F or
        0x200D  == cp
    )

def draw_text_hybrid(draw, img, pos, text, font_main, font_emoji_109, fill, font_size):
    x, y = pos
    if not os.path.exists(FONT_EMOJI) or not font_emoji_109:
        draw.text((x, y), text, font=font_main, fill=fill)
        return

    i = 0
    while i < len(text):
        char = text[i]
        if is_emoji(char):
            seq = char
            while i + 1 < len(text) and is_emoji(text[i+1]):
                i += 1
                seq += text[i]
            try:
                em_size = int(font_size * 1.1)
                em_tile = Image.new('RGBA', (130, 130), (0,0,0,0))
                em_draw = ImageDraw.Draw(em_tile)
                em_draw.text((0, 0), seq, font=font_emoji_109, embedded_color=True)
                bbox = em_tile.getbbox()
                if bbox:
                    cropped = em_tile.crop(bbox)
                    resized = cropped.resize((int(cropped.width * em_size / cropped.height), em_size), Image.LANCZOS)
                    img.paste(resized, (int(x), int(y)), resized)
                    x += resized.width + 2
                else:
                    x += int(font_size * 0.8)
            except Exception:
                x += int(font_size * 0.8)
        else:
            bbox = draw.textbbox((0, 0), char, font=font_main)
            w = bbox[2] - bbox[0]
            if w <= 0:
                w = int(font_size * 0.5)
            draw.text((x, y), char, font=font_main, fill=fill)
            x += w
        i += 1

def wrap_text(text, font, draw, max_width):
    words = text.split()
    lines, line = [], ''
    for word in words:
        test = (line + ' ' + word).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] <= max_width:
            line = test
        else:
            if line:
                lines.append(line)
                line = ''
            word_bbox = draw.textbbox((0, 0), word, font=font)
            if word_bbox[2] > max_width:
                sub_line = ''
                for ch in word:
                    sub_test = sub_line + ch
                    if draw.textbbox((0, 0), sub_test, font=font)[2] <= max_width:
                        sub_line = sub_test
                    else:
                        if sub_line: lines.append(sub_line)
                        sub_line = ch
                line = sub_line
            else:
                line = word
    if line: lines.append(line)
    return lines

def load_circular_avatar(avatar_path, size):
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
    except Exception:
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
    except Exception: pass

    AV = 62
    AV_X = PAD + 18
    AV_Y = PAD + 8
    avatar = load_circular_avatar(avatar_path, AV) if avatar_path else None
    if avatar is not None:
        img.paste(avatar, (AV_X, AV_Y), avatar)

    fnt_name = ImageFont.truetype(FONT_BOLD, 26, index=0) if FONT_BOLD.endswith('.ttc') else ImageFont.truetype(FONT_BOLD, 26)
    font_emoji = ImageFont.truetype(FONT_EMOJI, 109) if os.path.exists(FONT_EMOJI) else None

    name_display = sender_name[:28] + ('...' if len(sender_name) > 28 else '')
    name_x = AV_X + AV + 12 if avatar is not None else PAD + 18
    name_y = AV_Y + (AV // 2) - 14

    draw_text_hybrid(draw, img, (name_x, name_y), name_display, fnt_name, font_emoji, COLORS['name'], 26)

    name_bbox = draw.textbbox((0, 0), name_display, font=fnt_name)
    header_bottom = max(AV_Y + AV, name_y + name_bbox[3])
    div_y = header_bottom + 12
    draw.line([(PAD, div_y), (W-PAD, div_y)], fill=(88,166,255,60), width=1)

    text_x = PAD + 18
    text_y = div_y + 14
    max_text_w = W - text_x - PAD
    max_text_h = H - text_y - PAD - 40

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
        fnt_quote = ImageFont.truetype(FONT_REG, size, index=0) if FONT_REG.endswith('.ttc') else ImageFont.truetype(FONT_REG, size)
        lines = wrap_text(quote_text, fnt_quote, draw, max_text_w)
        line_h = draw.textbbox((0,0),'Ag', font=fnt_quote)[3] + 6
        if len(lines) * line_h <= max_text_h: break

    cy = text_y
    for line in lines:
        if cy + line_h > H - PAD - 30:
            draw_text_hybrid(draw, img, (text_x, cy), '...', fnt_quote, font_emoji, COLORS['quote'], size)
            break
        draw_text_hybrid(draw, img, (text_x, cy), line, fnt_quote, font_emoji, COLORS['quote'], size)
        cy += line_h

    fnt_footer = ImageFont.truetype(FONT_REG, 15, index=0) if FONT_REG.endswith('.ttc') else ImageFont.truetype(FONT_REG, 15)
    draw_text_hybrid(draw, img, (PAD+18, H-PAD-2), 'via QuoteBot \u2726', fnt_footer, font_emoji, COLORS['footer'], 15)
    img.save(output_path, 'WEBP', quality=92)
    print(f'OK:{output_path}')

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print('Usage: script.py <name> <text> <outpath> [avatar_path]'); sys.exit(1)
    _av = sys.argv[4] if len(sys.argv) > 4 else None
    generate(sys.argv[1], sys.argv[2], sys.argv[3], _av)
