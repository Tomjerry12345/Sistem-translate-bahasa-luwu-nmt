from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
import os
import tensorflow as tf
import tensorflow_text as tf_text
from moviepy.editor import VideoFileClip, CompositeVideoClip, TextClip
import whisper
import os
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from nltk.translate.bleu_score import sentence_bleu
from rouge_score import rouge_scorer
import subprocess
import time

app = Flask(__name__)
CORS(app)

output_audio = "storage/output_audio.mp3"
output_srt = "storage/output_subtitle.srt"
output_video = "output/output_video.mp4"
path_model = "model"
reloaded = tf.saved_model.load(path_model)

log = []

# Variabel untuk menyimpan status loading
status_progress = {}

# Pastikan direktori 'storage' ada
if not os.path.exists('storage'):
    os.makedirs('storage')


def processText(subtitle):
    # Membaca file input dan memisahkan teks indonesia dan luwu
    with open(subtitle, 'r', encoding='utf-8') as file:
        lines = file.readlines()

    actual_luwu = []

    # Proses setiap baris dalam file
    for line in lines:
        line = line.strip()
        if line.startswith("luwu:"):
            # Mengambil teks setelah label "luwu:"
            actual_luwu.append(line.replace("luwu:", "").strip())

    return actual_luwu


def processingWhisper(audio):
    whisper_model = whisper.load_model("large")
    result = whisper_model.transcribe(audio, language="indonesian")
    print(result["text"])
    return result


# Fungsi Tokenisasi
def tf_lower_and_split_punct(text):
    # Split accented characters.
    text = tf_text.normalize_utf8(text, 'NFKD')
    text = tf.strings.lower(text)
    # Keep space, a to z, selected punctuation, apostrophe, and hyphen.
    text = tf.strings.regex_replace(text, "[^ a-z.?!,¿'-]", '')
    # Add spaces around punctuation (except apostrophe and hyphen).
    text = tf.strings.regex_replace(text, '[.?!,¿]', r' \0 ')
    # Strip whitespace.
    text = tf.strings.strip(text)

    return text


# Fungsi untuk menghitung BLEU Score
def calculate_bleu_score(reference_text, translated_text):
    reference_tokens = tf_lower_and_split_punct(reference_text).numpy().decode()
    translated_tokens = tf_lower_and_split_punct(translated_text).numpy().decode()

    # Menghitung BLEU Score dengan menggunakan NLTK
    bleu_score = sentence_bleu([reference_tokens], translated_tokens)
    return round(bleu_score, 2)


# Fungsi untuk mengonversi waktu ke format SRT
def to_srt_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"


# Fungsi untuk menyimpan subtitle ke file .srt
def save_srt(subtitle_data, filename):
    with open(filename, 'w', encoding='utf-8') as f:
        for i, (start_time, end_time, indonesia_text, luwu_text, bleu_score) in enumerate(subtitle_data):
            f.write(f"{i + 1}\n")
            f.write(f"{to_srt_time(start_time)} --> {to_srt_time(end_time)}\n")
            f.write(f"Indonesia: {indonesia_text}\n")
            f.write(f"Luwu: {luwu_text}\n")
            f.write(f"BLEU score: {bleu_score}\n")
            f.write("\n")


def predict(result, subtitle):
    # Ambil segmen teks dari result['segments']
    subtitle_data = []  # List untuk menyimpan data subtitle
    i = 0

    for segment in result['segments']:
        start_time = segment['start']
        end_time = segment['end']
        indonesia_text = segment['text']

        actual = subtitle[i].lower()
        actual = subtitle[i].replace(",", " ,")

        # Proses terjemahan dan hitung BLEU score
        res = reloaded.translate([indonesia_text])  # Proses terjemahan
        pred = res[0].numpy().decode()

        bleu_score = calculate_bleu_score(actual, pred)
        scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=True)
        scores = scorer.score(actual, pred)

        print(f"indonesia: {indonesia_text}")
        print(f"luwu: {actual}")
        print(f"pred: {pred}")
        print(f"BLEU score: {bleu_score}")
        print(f"Rouge-1 Score:: {scores['rouge1'].fmeasure}")
        print(f"Rouge-2 Score:: {scores['rouge2'].fmeasure}")
        print(f"rouge-L Score:: {scores['rougeL'].fmeasure}")

        print("=" * 92)

        # Simpan data untuk SRT
        subtitle_data.append((start_time, end_time, indonesia_text, pred, bleu_score))

        log.append({
            "indonesia": indonesia_text,
            "luwu": actual,
            "pred": pred,
            "bleu_score": bleu_score,
            "rouge1": scores['rouge1'].fmeasure,
            "rouge2": scores['rouge2'].fmeasure,
            "rougeL": scores['rougeL'].fmeasure,
        })

        i += 1

    return subtitle_data


def add_subtitle_to_video(input_video, subtitle_file, output):
    # Perintah FFmpeg untuk menambahkan subtitle ke dalam video
    command = [
        'ffmpeg', '-y', '-i', input_video, '-vf', f"subtitles={subtitle_file}", output
    ]

    # Menjalankan perintah FFmpeg menggunakan subprocess
    try:
        subprocess.run(command, check=True)
        print(f"Video dengan subtitle tersimpan sebagai {output}")
    except subprocess.CalledProcessError as e:
        print(f"Terjadi kesalahan saat menambahkan subtitle: {e}")


def delete_files(directory):
    for filename in os.listdir(directory):
        file_path = os.path.join(directory, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                os.rmdir(file_path)
        except Exception as e:
            print(f'Gagal menghapus {file_path}. Error: {e}')


@app.route('/status/<task_id>', methods=['GET'])
def get_status(task_id):
    def generate():
        while True:
            if task_id in status_progress:
                yield f"data: {status_progress[task_id]}\n\n"
                if status_progress[task_id] >= 100:
                    break
            time.sleep(1)  # Adjust delay as needed

    return Response(generate(), mimetype='text/event-stream')


@app.route('/upload', methods=['POST'])
def upload_video():
    task_id = "video_upload_task"
    status_progress[task_id] = 0

    # Simpan video dan subtitle di folder 'storage'
    if 'video' not in request.files or 'subtitle' not in request.files:
        return jsonify({'error': 'Tidak ada file yang diunggah'}), 400

    video = request.files['video']
    subtitle = request.files['subtitle']

    video_path = os.path.join('storage', video.filename)
    subtitle_path = os.path.join('storage', subtitle.filename)
    video.save(video_path)
    subtitle.save(subtitle_path)

    status_progress[task_id] = 10  # Update progres

    # Proses lainnya
    try:
        video_clip = VideoFileClip(video_path)
        audio = video_clip.audio
        audio.write_audiofile(output_audio)

        status_progress[task_id] = 30  # Update progres
        audio.close()
        video_clip.close()

        result = processingWhisper(output_audio)
        status_progress[task_id] = 60  # Update progres

        subtitle_data = predict(result, processText(subtitle_path))
        save_srt(subtitle_data, output_srt)
        status_progress[task_id] = 80  # Update progres

        add_subtitle_to_video(video_path, output_srt, output_video)
        status_progress[task_id] = 100  # Proses selesai

        delete_files("storage")

        status_progress[task_id] = 0  # Proses selesai

    except Exception as e:
        status_progress[task_id] = -1  # Menandakan error
        return jsonify({'error': str(e)}), 500

    video_url = f"http://localhost:5000/output/{os.path.basename(output_video)}"

    return jsonify({
        'message': 'Proses selesai',
        'video_url': video_url,
        "log": log
    }), 200


@app.route('/output/<path:filename>', methods=['GET'])
def serve_output_file(filename):
    return send_from_directory('output', filename)


@app.route('/', methods=['GET'])
def test():
    return jsonify({
        'message': 'Video dan subtitle berhasil diupload',
        'video_url': f'/storage',
        'subtitle_url': f'/storage/'
    }), 200


if __name__ == '__main__':
    app.run(debug=True)
