import subprocess
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


reelPath = "./assets/reels/reel_1702540295.mp4"
seoTitle = "Test Title"
seoDescription = "Test Description"
seoHashtags = "#test, #test2"


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
