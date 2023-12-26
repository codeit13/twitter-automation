# %%
import subprocess
from progress.bar import Bar
from dotenv import load_dotenv

load_dotenv()


def run_shell_command(command):
    """
    Run a shell command and return the output.

    Args:
    - command (str): The shell command to execute.

    Returns:
    - str: The output of the command.
    """
    try:
        result = subprocess.run(
            command,
            shell=True,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        print(result.stdout.strip())
        return result.stdout.strip()

    except subprocess.CalledProcessError as e:
        # If the command fails, you might want to handle the error
        print(f"Command Failed. Error Message: {e.stderr.strip()}")
        return None


# %%
from faster_whisper import WhisperModel

model_size = "medium"
# if dummy == False:
model = WhisperModel(model_size, compute_type="float32")

# %%
# @markdown # **Content Generation** 🚀
dummy = False
import os, json, re, random
from openai import OpenAI

bar = Bar("Generating Content", max=1)

client = OpenAI(
    # This is the default and can be omitted
    api_key=os.getenv("OPENAI_API_KEY"),
)

topics = [
    "Dirty History Facts",
    "Greek empire attrocities",
    "Slaves in Ancient Civilizations",
    "Britishers in India",
    "British Colonies",
    "Daily Life in Ancient Empires",
    "Untold Stories of Ancient Civilizations",
    "Celestial Marvels: Space Discoveries Unveiled",
    "Ancient Empires",
    "Mysteries of the Past",
    "Time Capsule: Uncovering Ancient Artifacts",
    "Legends and Lore: Historical Tales in a Minute",
    "Battles (epic) of History",
    "Hidden Treasures: Forgotten Artifacts of the Past",
    "Time-Travel Tech: Concepts and Possibilities",
    "Lost Cities: Unearthed Histories and Ancient Mysteries",
    "Amazing Animal Facts",
    "Mindful Living Tips ",
]

random_topic = random.choice(topics)
if dummy == False:
    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "system",
                "content": "You are an expert short form video content generator, your content is straight to the point, and very accurate.",
            },
            {
                "role": "user",
                "content": "Write the audio script (max 600 characters long) for a video on "
                + random_topic
                + ". Use TikTok video script tone. Start from 'Did you know' statements. Share multiple shorts facts in same context as intial statements that will blow listener's mind, and are very less commonly heard. Have a bias for impact value statements with numbers. Skip opening hi/hello welcome kind of statements, directly jump to the story which will keep the user hooked. Try to pack the maximum useful information in the script as possible. Use “Global English” to make content and context accessible for non-native comprehension. Don’t use idioms. Be literal and stay away from metaphors and colloquial language. Keep sentences short. Standardise terminology to minimise changes. Avoid directional language. Use inclusive, accessible, person-first language. This audio script will be further fed into TTS engine so write accordingly. Also return seo title, seo description and seo hashtags (only 3 tags) for youtube uploads. Keep title very very short.\nReturn your answer strictly in this json format: { 'script': '', seoTitle: '', seoDescription: '', seoHashtags: '' }",
            },
        ],
        model="gpt-4-1106-preview",
        # model="gpt-3.5-turbo-1106",
        response_format={"type": "json_object"},
    )

    content = json.loads(chat_completion.choices[0].message.content)
    audioScript = re.sub(r"#[a-zA-Z0-9_]+", "", content.get("script"))

else:
    content = {
        "script": "Did you know the ancient Greek empire had a dark side? Mind-blowing fact: The Spartans threw weak babies off cliffs! That's just the tip of the iceberg. Here's more - in Athens, slavery was a major industry with every citizen owning at least one slave. The Greeks also believed in human sacrifice, particularly during times of war. And the famous Greek philosophers? Many of them taught that some lives were simply worth more than others. These are unsettling truths behind the pillars and poetry of ancient Greece.",
        "seoTitle": "Dark Side of Ancient Greece",
        "seoDescription": "Uncover the shocking atrocities of the ancient Greek empire. From Spartan infanticide to Athenian slavery and human sacrifices - the untold history revealed!",
        "seoHashtags": "#AncientGreece #HistoryFacts #DarkPast",
    }

bar.next()
bar.finish()

seoTitle = content.get("seoTitle")
seoHashtags = content.get("seoHashtags")
seoDescription = content.get("seoDescription")
videoTags = []

fallBackTag = random_topic.split(" ")[0]

print(json.dumps(content, indent=4))


# %%
# @markdown # **Audio File (TTS)** 🚀
dummy = False
import os
from datetime import datetime
from openai import OpenAI

bar = Bar("TTS Audio", max=1)
client = OpenAI(
    # This is the default and can be omitted
    api_key=os.getenv("OPENAI_API_KEY"),
)

audioPath = "./assets/audios/ai_audio.mp3"
audiofilename = audioPath

if dummy == False:
    response = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=audioScript,
    )
    response.stream_to_file(audioPath)

bar.next()
bar.finish()
# %%
import json

bar = Bar("Whisper Transcription", max=1)
segments, info = model.transcribe(audioPath, word_timestamps=True)

segments = list(segments)  # The transcription will actually run here.
wordlevel_info = []

for segment in segments:
    for word in segment.words:
        wordlevel_info.append({"word": word.word, "start": word.start, "end": word.end})

modified_wordlevel_info = []
for word_info in wordlevel_info:
    modified_wordlevel_info.append(
        {
            "start": word_info["start"],
            "end": word_info["end"],
            "word": word_info["word"].strip(),
        }
    )
bar.next()
bar.finish()


# %%
def split_text_into_lines(data):
    MaxChars = 15
    # maxduration in seconds
    MaxDuration = 2.5
    # Split if nothing is spoken (gap) for these many seconds
    MaxGap = 1.5

    subtitles = []
    line = []
    line_duration = 0
    line_chars = 0

    for idx, word_data in enumerate(data):
        word = word_data["word"]
        start = word_data["start"]
        end = word_data["end"]

        line.append(word_data)
        line_duration += end - start

        temp = " ".join(item["word"] for item in line)

        # Check if adding a new word exceeds the maximum character count or duration
        new_line_chars = len(temp)

        duration_exceeded = line_duration > MaxDuration
        chars_exceeded = new_line_chars > MaxChars
        if idx > 0:
            gap = word_data["start"] - data[idx - 1]["end"]
            # print (word,start,end,gap)
            maxgap_exceeded = gap > MaxGap
        else:
            maxgap_exceeded = False

        if duration_exceeded or chars_exceeded or maxgap_exceeded:
            if line:
                subtitle_line = {
                    "word": " ".join(item["word"] for item in line),
                    "start": line[0]["start"],
                    "end": line[-1]["end"],
                    "textcontents": line,
                }
                subtitles.append(subtitle_line)
                line = []
                line_duration = 0
                line_chars = 0

    if line:
        subtitle_line = {
            "word": " ".join(item["word"] for item in line),
            "start": line[0]["start"],
            "end": line[-1]["end"],
            "textcontents": line,
        }
        subtitles.append(subtitle_line)

    return subtitles


linelevel_subtitles = split_text_into_lines(modified_wordlevel_info)


# %%
dummy = False
import requests, random
import urllib.request, time, json

from datetime import datetime
from openai import OpenAI

# print(json.dumps(linelevel_subtitles, indent=4))
audioDuration = float(
    run_shell_command(
        'ffprobe -i assets/audios/ai_audio.mp3 -show_entries format=duration -v quiet -of csv="p=0"'
    )
)

transcript = "I have a transcript of a {audioDuration} second long video below in this format: start: <start_time>, end: <end_time>, line: <line_text>\n\n"
for entry in linelevel_subtitles:
    transcript += (
        f"start: {entry['start']}s , end: {entry['end']}s , line: {entry['word']}\n"
    )

transcript += "\n\n\nI wwant to generate strictly some tags for this video transcript, each 3s long for the entire duration of the video, it will be further used to generate stock footages for this video. I want asmr kind of stock footage for my videos so generate tags accordingly. Make sure to keep the time duration between tags same. Return video tags in this json format: { 'tags': [{ start: <start_time>, end: <end_time>, tags: '' }] } \n\n"

client = OpenAI(
    # This is the default and can be omitted
    api_key=os.getenv("OPENAI_API_KEY"),
)
if dummy == False:
    chat_completion = client.chat.completions.create(
        model="gpt-4-1106-preview",
        # model="gpt-3.5-turbo-1106",
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": transcript}],
    )
    videoTags = json.loads(chat_completion.choices[0].message.content)["tags"]
else:
    videoTags = [
        {"start": "0.0s", "end": "3.0s", "tags": "space, planets, solar system"},
        {"start": "3.0s", "end": "6.0s", "tags": "exoplanet, 55 Cancri E, diamonds"},
        {"start": "6.0s", "end": "9.0s", "tags": "carbon, atmosphere, pressure"},
        {
            "start": "9.0s",
            "end": "12.0s",
            "tags": "diamond formation, extreme conditions",
        },
        {
            "start": "12.0s",
            "end": "15.0s",
            "tags": "scientific imagination, carbon atoms",
        },
        {"start": "15.0s", "end": "18.0s", "tags": "diamond rain, surreal beauty"},
        {"start": "18.0s", "end": "21.0s", "tags": "planet mass, scientific estimates"},
        {"start": "21.0s", "end": "24.0s", "tags": "mysteries of the universe"},
        {"start": "24.0s", "end": "27.0s", "tags": "cosmic wonders, distant planets"},
        {"start": "27.0s", "end": "30.0s", "tags": "wonder and awe"},
        {"start": "30.0s", "end": "33.0s", "tags": "space exploration, universe"},
        {"start": "33.0s", "end": "36.0s", "tags": "cosmic mysteries, contemplation"},
    ]

# print(json.dumps(videoTags, indent=4))
print("Successfully generated video tags...")

# %%
print("Starting stock video fetching process...")

url = "https://api.pexels.com/videos/search"
headers = {"Authorization": "aZB4nryvsXVSv6T6EUWmf4flWHX1ZPestuRD0OQ91FgEL5H9XuRxnxHH"}

# Collect video links for each tags per sentence
for entry in videoTags:
    tags = []
    tags.append(entry["tags"])
    # tags = entry['tags'].replace("_", " ").split(",")
    tags.append(fallBackTag)

    videos = []
    for tag in tags:
        tagVideos = (
            requests.get(
                url,
                headers=headers,
                params={
                    "query": tag,
                    "orientation": "portrait",
                    "per_page": 80,
                },
            )
            .json()
            .get("videos")
        )
        firstVideoWidth = 0
        firstVideoHeight = 0
        for userVideos in tagVideos:
            for video in userVideos.get("video_files"):
                if video.get("width") != 0 and video.get("height") != 0:
                    aspectRatio = video.get("width") / video.get("height")
                    if aspectRatio < 1:
                        if firstVideoWidth == 0 or firstVideoHeight == 0:
                            firstVideoWidth = video.get("width")
                            firstVideoHeight = video.get("height")
                            videos.append(video)
                        else:
                            if firstVideoWidth == video.get(
                                "width"
                            ) and firstVideoHeight == video.get("height"):
                                video["user"] = userVideos.get("user")
                                videos.append(video)
    print(f"Found {len(videos)} videos")
    entry["video"] = videos[random.randint(0, len(videos) - 1)]
    videoPath = f"./assets/videos/stock_video_{int(time.time())}.mp4"
    urllib.request.urlretrieve(entry["video"]["link"], videoPath)
    entry["video"]["path"] = videoPath

# print(json.dumps(videoTags, indent=4))

# %%
import time

audioDuration = (
    int(
        float(
            run_shell_command(
                'ffprobe -i assets/audios/ai_audio.mp3 -show_entries format=duration -v quiet -of csv="p=0"'
            )
        )
    )
    + 2
)

dummy = False
for i, video in enumerate(videoTags):
    videoPath = video["video"]["path"]
    videoDuration = float(
        audioDuration
        if i == len(videoTags) - 1
        else float(str(video["end"]).replace("s", ""))
    ) - float(str(video["start"]).replace("s", ""))
    newVideoPath = f"assets/videos/stock_video_{int(time.time())}.mp4"
    print(f"Trimming Video {i+1} to {videoDuration}s...", end=" ")
    run_shell_command(
        f"ffmpeg -i {videoPath} -ss 00 -to {videoDuration} -c:a copy -y {newVideoPath}"
    )
    video["video"]["newPath"] = newVideoPath
    print("Done...\n")

if dummy == False:
    mergeVideoCommand = "ffmpeg "

    for video in videoTags:
        videoPath = video["video"]["newPath"]
        mergeVideoCommand += f"-i {videoPath} "

    mergeVideoCommand += (
        f'-i ./assets/audios/ai_audio.mp3 -i ./bg_audio.mp3 -filter_complex "'
    )

    for i, video in enumerate(videoTags):
        mergeVideoCommand += f"[{i}:v]scale=1080:1920[v{i}];"

    for i, video in enumerate(videoTags):
        mergeVideoCommand += f"[v{i}]"

    # Audio duration has to be 59s, since it is a youtube short
    audioDuration = audioDuration if audioDuration < 59 else 59
    mergeVideoCommand += f'concat=n={len(videoTags)}:v=1:a=0[outv];[{len(videoTags)}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[vaudio];[{len(videoTags)+1}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[vbackground];[vbackground]volume=0.05[vb];[vaudio][vb]amix=inputs=2:duration=longest[a]" -map "[outv]" -map "[a]" -vsync vfr -ss 00 -to {audioDuration} -crf 24 -y assets/videos/trimmed_video.mp4'

    print("Executing this merge Command: ", mergeVideoCommand)

    run_shell_command(mergeVideoCommand)

output_video_path = "./assets/videos/trimmed_video.mp4"
print(f"Combined video saved to: {output_video_path}")

# %%
from moviepy.editor import TextClip, CompositeVideoClip, ColorClip

# import numpy as np
import math
import textwrap
from PIL import Image, ImageFont


def soft_wrap_text(
    text: str,
    fontsize: int,
    letter_spacing: int,
    font_family: str,
    max_width: int,
):
    # Note that font_family has to be an absolut path to your .ttf/.otf
    image_font = ImageFont.truetype(font_family, fontsize)

    # I am not sure my letter spacing calculation is accurate
    text_width = image_font.getlength(text) + (len(text) - 1) * letter_spacing
    letter_width = text_width / len(text)

    if text_width < max_width:
        return text

    max_chars = max_width / letter_width
    wrapped_text = textwrap.fill(text, width=max_chars)
    return wrapped_text


def zoom_in_effect(clip, zoom_ratio=0.04):
    def effect(get_frame, t):
        img = Image.fromarray(get_frame(t))
        base_size = img.size

        new_size = [
            math.ceil(img.size[0] * (1 + (zoom_ratio * t))),
            math.ceil(img.size[1] * (1 + (zoom_ratio * t))),
        ]

        # The new dimensions must be even.
        new_size[0] = new_size[0] + (new_size[0] % 2)
        new_size[1] = new_size[1] + (new_size[1] % 2)

        img = img.resize(new_size, Image.LANCZOS)

        x = math.ceil((new_size[0] - base_size[0]) / 2)
        y = math.ceil((new_size[1] - base_size[1]) / 2)

        img = img.crop([x, y, new_size[0] - x, new_size[1] - y]).resize(
            base_size, Image.LANCZOS
        )

        result = numpy.array(img)
        img.close()

        return result

    return clip.fl(effect)


def create_caption(
    textJSON,
    framesize,
    font="Bevan Regular",
    color="white",
    bgcolor="yellow",
    stroke_color="black",
    stroke_width=4,
):
    wordcount = len(textJSON["textcontents"])
    full_duration = textJSON["end"] - textJSON["start"]

    word_clips = []
    xy_textclips_positions = []

    x_pos = 0
    y_pos = 0
    # max_height = 0
    frame_width = framesize[0]
    frame_height = framesize[1]

    x_buffer = frame_width * 1 / 12
    y_buffer = frame_height * 1 / 2

    fontsize = int(frame_height * 0.035)  # 3.5 percent of video height

    space_width = ""
    space_height = ""

    for index, wordJSON in enumerate(textJSON["textcontents"]):
        duration = wordJSON["end"] - wordJSON["start"]

        # TextClip

        wrap_title = soft_wrap_text(
            wordJSON["word"],
            font_family="/usr/share/fonts/truetype/Bevan/Bevan-Regular.ttf",
            fontsize=fontsize,
            letter_spacing=12,
            max_width=frame_width * 0.8,  # *0.8 for some padding
        )

        word_clip = (
            TextClip(
                " " + wrap_title + " ",
                font=font,
                fontsize=fontsize,
                color=color,
                stroke_color=stroke_color,
                stroke_width=stroke_width,
                align="center",
            )
            .set_start(textJSON["start"])
            .set_duration(full_duration)
        )
        word_clip_space = (
            TextClip(" ", font=font, fontsize=fontsize, color=color)
            .set_start(textJSON["start"])
            .set_duration(full_duration)
        )
        word_width, word_height = word_clip.size
        space_width, space_height = word_clip_space.size

        # Uncomment if adding a space text clip
        if x_pos + word_width + space_width > frame_width - 2 * x_buffer:
            # Move to the next line
            x_pos = 0
            y_pos = y_pos + word_height + 40

            # Store info of each word_clip created
            xy_textclips_positions.append(
                {
                    "x_pos": x_pos + x_buffer,
                    "y_pos": y_pos + y_buffer,
                    "width": word_width,
                    "height": word_height,
                    "word": wordJSON["word"],
                    "start": wordJSON["start"],
                    "end": wordJSON["end"],
                    "duration": duration,
                }
            )

            word_clip = word_clip.set_position((x_pos + x_buffer, y_pos + y_buffer))
            word_clip_space = word_clip_space.set_position(
                (x_pos + word_width + x_buffer, y_pos + y_buffer)
            )
            x_pos = word_width + space_width
        else:
            # Store info of each word_clip created
            xy_textclips_positions.append(
                {
                    "x_pos": x_pos + x_buffer,
                    "y_pos": y_pos + y_buffer,
                    "width": word_width,
                    "height": word_height,
                    "word": wordJSON["word"],
                    "start": wordJSON["start"],
                    "end": wordJSON["end"],
                    "duration": duration,
                }
            )

            word_clip = word_clip.set_position((x_pos + x_buffer, y_pos + y_buffer))
            word_clip_space = word_clip_space.set_position(
                (x_pos + word_width + x_buffer, y_pos + y_buffer)
            )

            x_pos = x_pos + word_width + space_width

        word_clips.append(word_clip)
        word_clips.append(word_clip_space)

    for highlight_word in xy_textclips_positions:
        wrap_title = soft_wrap_text(
            highlight_word["word"],
            font_family="/usr/share/fonts/truetype/Bevan/Bevan-Regular.ttf",
            fontsize=fontsize,
            letter_spacing=12,
            max_width=frame_width * 0.8,  # *0.8 for some padding
        )
        word_clip_highlight = (
            TextClip(
                " " + wrap_title + " ",
                font=font,
                fontsize=fontsize,
                color=color,
                bg_color=bgcolor,
                stroke_color=stroke_color,
                stroke_width=stroke_width,
                align="center",
            )
            .set_start(highlight_word["start"])
            .set_duration(highlight_word["duration"])
            .set_position("center")
        )
        word_clip_highlight = word_clip_highlight.set_position(
            (highlight_word["x_pos"], highlight_word["y_pos"])
        )
        word_clips.append(word_clip_highlight)

    return word_clips


# %%
from moviepy.editor import (
    TextClip,
    CompositeVideoClip,
    concatenate_videoclips,
    VideoFileClip,
    ColorClip,
)

# Load the input video
input_video = VideoFileClip(output_video_path)
frame_size = input_video.size

all_linelevel_splits = []

for line in linelevel_subtitles:
    out = create_caption(line, frame_size)
    all_linelevel_splits.extend(out)

# Get the duration of the input video
input_video_duration = input_video.duration
# Create a color clip with the given frame size, color, and duration
# background_clip = ColorClip(size=frame_size, color=(255, 154, 172)).set_duration(input_video_duration)

# If you want to overlay this on the original video uncomment this and also change frame_size, font size and color accordingly.
final_video = CompositeVideoClip([input_video] + all_linelevel_splits).set_position(
    "center"
)

# final_video = CompositeVideoClip([background_clip] + all_linelevel_splits)

# Set the audio of the final video to be the same as the input video
final_video = final_video.set_audio(input_video.audio)

# Save the final clip as a video file with the audio included
reelPath = f"./assets/reels/reel_{int(time.time())}.mp4"
final_video.write_videofile(
    reelPath,
    fps=30,
    codec="libx264",
    audio_codec="aac",
    ffmpeg_params=["-pix_fmt", "yuv420p"],
)

# %% [markdown]
# Youtube Upload

# %%
thumbFilePath = f"./assets/images/yt_thumbnail.png"
run_shell_command(
    f"ffmpeg -i {reelPath} -frames:v 1 -ss 10 -f image2 -y {thumbFilePath}"
)
thumbFilePath = "FALSE" or os.path.abspath(thumbFilePath)
import json, os

with open("./assets/files/yt_upload_args.json", "w") as f:
    json.dump(
        {
            "title": seoTitle.split("|")[0].strip(),
            "description": f"{seoDescription}\n\nPhotos provided by Pexels\n\nMusic: bensound.com\nLicense code: OT8XBWRLANC7HXPR",
            "tags": seoHashtags,
            "videoFilePath": os.path.abspath(reelPath),
            "thumbFilePath": thumbFilePath,
        },
        f,
        indent=4,
    )
run_shell_command("node utils/youtube-upload.js run")

# %%
