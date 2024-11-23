"use client";

import { useEffect, useState } from "react";

export default function StatusPage() {
  const [progress, setProgress] = useState(0);

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

  //   return (
  //     <div>
  //       <h1>Proses Upload Video</h1>
  //       <p>Progress: {progress}%</p>
  //     </div>
  //   );

  return {
    progress: progress,
  };
}
