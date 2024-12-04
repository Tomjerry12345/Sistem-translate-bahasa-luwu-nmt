"use client";

import Button from "@/components/button";
import { ResType } from "@/lib/definition";
import { postGenerateVideo } from "@/lib/services";
import { useEffect, useRef, useState } from "react";

const Home = () => {
  const hiddenVideoInput = useRef<HTMLInputElement | null>(null);
  const hiddenSubtitleInput = useRef<HTMLInputElement | null>(null);

  const [input, setInput] = useState({
    video: "",
    subtitle: "",
  });

  const [fileNames, setFileNames] = useState({
    video: "Pick video",
    subtitle: "Pick actual language",
  });

  const [progress, setProgress] = useState(0);

  const [res, setRes] = useState<ResType | null>(null);

  // const results = [
  //   {
  //     indonesia: "Udah bersih",
  //     luwu: "mapaccingmo?",
  //     pred: "temba'",
  //     bleu_score: 0.0,
  //     rouge1: 0.0,
  //     rouge2: 0.0,
  //     rougeL: 0.0,
  //   },
  //   {
  //     indonesia: "Kemana perginya ya",
  //     luwu: "Umba naolai manjo le?",
  //     pred: "umba naolai manjo",
  //     bleu_score: 0.75,
  //     rouge1: 0.8571428571428571,
  //     rouge2: 0.8,
  //     rougeL: 0.8571428571428571,
  //   },
  //   {
  //     indonesia: "Kemana perginya ya",
  //     luwu: "Umba naolai manjo le?",
  //     pred: "umba naolai manjo",
  //     bleu_score: 0.75,
  //     rouge1: 0.8571428571428571,
  //     rouge2: 0.8,
  //     rougeL: 0.8571428571428571,
  //   },
  //   {
  //     indonesia: "Kemana perginya ya",
  //     luwu: "Umba naolai manjo le?",
  //     pred: "umba naolai manjo",
  //     bleu_score: 0.75,
  //     rouge1: 0.8571428571428571,
  //     rouge2: 0.8,
  //     rougeL: 0.8571428571428571,
  //   },
  // ];

  useEffect(() => {
    const eventSource = new EventSource(
      "http://localhost:5000/status/video_upload_task"
    );

    eventSource.onmessage = (event) => {
      setProgress(Number(event.data));
      if (Number(event.data) >= 100) {
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    key: "video" | "subtitle"
  ) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setInput({ ...input, [key]: file });
      setFileNames({ ...fileNames, [key]: file.name });
    }
  };

  const onClickVideo = () => {
    hiddenVideoInput.current?.click();
  };

  const onClickSubtitle = () => {
    hiddenSubtitleInput.current?.click();
  };

  const onClickGenerate = async () => {
    console.log(input);
    const response = await postGenerateVideo(input);

    if (response && response.video_url) {
      setRes(response); // Menyimpan respons video_url ke state
      setFileNames({
        video: "Pick video",
        subtitle: "Pick actual language",
      });
      setInput({
        video: "",
        subtitle: "",
      });
    } else {
      alert("Gagal memproses video.");
    }
  };

  return (
    <div
      className="rounded overflow-hidden shadow-lg p-4"
      style={{
        height: "calc(100vh - 32px)",
        background: "#221D2B",
      }}
    >
      <div className="grid grid-cols-3 gap-4 h-full">
        <div className="box h-full w-full col-span-2 flex items-center justify-center">
          {res?.video_url ? (
            <iframe
              width="1000"
              height="600"
              src={res.video_url} // URL video dari Flask
              title="Generated Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <p className="text-white text-xl">Video belum tersedia</p>
          )}
        </div>
        <div className="box-2 h-full w-full py-2 col-span-1">
          <h6>Log</h6>
          <div className="box-view flex flex-col rounded shadow-lg mt-2">
            {res?.log.map((result, index) => (
              <pre
                key={index}
                style={{
                  // background: "#f4f4f4",
                  color: "white",
                  padding: "10px",
                  borderRadius: "5px",
                  // width: "100px",
                  margin: "10px 0",
                  maxWidth: "100%", // Batasi lebar maksimal elemen
                  // whiteSpace: "pre-wrap", // Bungkus teks secara otomatis
                  // wordWrap: "break-word", // Pecah kata panjang jika melebihi
                  // overflow: "hidden", // Hindari scroll horizontallebar
                }}
              >
                ============================================================================================
                <br />
                GRU:
                <br />
                indonesia: {result[0]["indonesia"]}
                {result[0]["luwu"] && (
                  <>
                    {`luwu: ${result[0]["luwu"]}`}
                    <br />
                  </>
                )}
                pred: {result[0]["pred"]}
                <br />
                {result[0]["bleu_score"] && (
                  <>
                    BLEU score: {result[0]["bleu_score"]}
                    <br />
                  </>
                )}
                {result[0]["rouge1"] && (
                  <>
                    Rouge-1 Score:: {result[0]["rouge1"]}
                    <br />
                  </>
                )}
                {result[0]["rouge2"] && (
                  <>
                    Rouge-2 Score:: {result[0]["rouge2"]}
                    <br />
                  </>
                )}
                {result[0]["rougeL"] && (
                  <>
                    Rouge-L Score:: {result[0]["rougeL"]}
                    <br />
                  </>
                )}
                <br />
                <br />
                RNN:
                <br />
                indonesia: {result[1]["indonesia"]}
                <br />
                {result[1]["luwu"] && (
                  <>
                    {`luwu: ${result[1]["luwu"]}`}
                    <br />
                  </>
                )}
                pred: {result[1]["pred"]}
                <br />
                {result[1]["bleu_score"] && (
                  <>
                    BLEU score: {result[1]["bleu_score"]}
                    <br />
                  </>
                )}
                {result[1]["rouge1"] && (
                  <>
                    Rouge-1 Score:: {result[1]["rouge1"]}
                    <br />
                  </>
                )}
                {result[1]["rouge2"] && (
                  <>
                    Rouge-2 Score:: {result[1]["rouge2"]}
                    <br />
                  </>
                )}
                {result[1]["rougeL"] && (
                  <>
                    Rouge-L Score:: {result[1]["rougeL"]}
                    <br />
                  </>
                )}
                <br />
                <br />
                ============================================================================================
              </pre>
            ))}
          </div>
          <div className="section-button flex items-end">
            <div className="flex flex-col gap-4 w-full">
              <input
                type="file"
                ref={hiddenVideoInput}
                onChange={(e) => handleChange(e, "video")}
                accept="video/*"
                style={{ display: "none" }}
              />
              <input
                type="file"
                ref={hiddenSubtitleInput}
                onChange={(e) => handleChange(e, "subtitle")}
                accept=".txt"
                style={{ display: "none" }}
              />
              <Button bg="#A12885" onClick={onClickVideo}>
                {fileNames.video}
              </Button>
              <Button bg="#2852A1" onClick={onClickSubtitle}>
                {fileNames.subtitle}
              </Button>
              <Button
                bg={progress === -1 ? "#A12828" : "#28A179"}
                onClick={onClickGenerate}
                disabled={progress != 0}
              >
                {progress === 0
                  ? "Generate"
                  : progress === -1
                  ? "Terjadi kesalahan"
                  : `${progress}%`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
