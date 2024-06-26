import { useRouter, useSearchParams } from "next/navigation";
import React, {
  useState,
  useEffect,
  useRef,
  Dispatch,
  SetStateAction,
} from "react";
import { FaCheckSquare, FaRegCheckSquare } from "react-icons/fa";

const mimeType = "audio/webm";

const AudioRecorder = ({
  sessionID,
  setResponseText,
  setResponseAudio,
  isDone,
  numberQuestions,
}: {
  sessionID: string | null;
  setResponseText: Dispatch<SetStateAction<string>>;
  setResponseAudio: Dispatch<SetStateAction<any>>;
  isDone: boolean;
  numberQuestions: string | null;
}) => {
  const [permission, setPermission] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const [recordingStatus, setRecordingStatus] = useState("inactive");
  const [audio, setAudio] = useState<string | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [fetchingResponse, setFetchingResponse] = useState(false);

  const getMicrophonePermission = async () => {
    if ("MediaRecorder" in window) {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        setPermission(true);
        setStream(mediaStream);
      } catch (err) {
        alert((err as Error).message);
      }
    } else {
      alert("The MediaRecorder API is not supported in your browser.");
    }
  };

  const router = useRouter();
  const searchParams = useSearchParams();

  const removeBase64Metadata = (base64data: string) => {
    return base64data.split(",")[1];
  };

  const startRecording = () => {
    if (stream) {
      setRecordingStatus("recording");
      const media = new MediaRecorder(stream, { mimeType });

      let chunks: Blob[] = [];

      media.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      media.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: mimeType });

        console.log("Audio Blob Size:", audioBlob.size);
        console.log("Audio Blob Type:", audioBlob.type);

        if (audioBlob.size === 0) {
          console.error("Empty audio blob. Recording may have failed.");
          return;
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        console.log("Audio URL:", audioUrl);

        setAudio(audioUrl);

        const base64data = await blobToBase64(audioBlob);
        const cleanedBase64data = removeBase64Metadata(base64data);
        setAudioBase64(cleanedBase64data);

        if (sessionID) {
          try {
            setFetchingResponse(true);
            const response = await fetch(
              "http://127.0.0.1:8000/interview_loop",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  session_id: sessionID,
                  user_audio: cleanedBase64data,
                }),
              }
            );

            if (response.ok) {
              const responseData = await response.json();
              const audioOutputBase64 = responseData.audio_output;
              const responseBlob = base64ToBlob(audioOutputBase64, mimeType);
              const responseAudioUrl = URL.createObjectURL(responseBlob);
              setResponseAudio(responseAudioUrl);
              const responseText = responseData.text_output;
              setResponseText(responseText);
            } else {
              console.error("Failed to fetch interview_loop:", response.status);
            }
          } catch (error: any) {
            console.error("Error fetching interview_loop:", error.message);
          } finally {
            setFetchingResponse(false);
          }
        } else {
          console.log("No session ID");
        }
      };

      mediaRecorder.current = media;
      mediaRecorder.current.start();
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && recordingStatus === "recording") {
      mediaRecorder.current.stop();
      setRecordingStatus("inactive");
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const base64ToBlob = (base64: string, type: string): Blob => {
    const binary = atob(base64);
    const array = [];
    for (let i = 0; i < binary.length; i++) {
      array.push(binary.charCodeAt(i));
    }
    return new Blob([new Uint8Array(array)], { type });
  };

  useEffect(() => {
    getMicrophonePermission();
  }, []);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [stream]);

  return (
    <div className="w-[100%] flex items-start mx-[5px]">
      <main>
        {isDone ? (
          <div className="audio-player">
            <h1 className="font-medium w-[160px] opacity-[0.7] text-[1rem] justify-center gap-x-[8px] items-center flex flex-row">
              Recieved
              <FaRegCheckSquare size={20} className="opacity-[0.8]" />
            </h1>
            {/*<audio className="bg-[#EEF3FA]" src={audio} controls></audio>*/}
          </div>
        ) : (
          <div className="w-[170px] flex items-center justify-center">
            {!permission ? <div className="loader"></div> : null}
            {permission &&
            recordingStatus === "inactive" &&
            !fetchingResponse ? (
              <button
                className="py-[10px] px-[15px] gap-x-[7px] items-center bg-[#6E87ED] rounded-[10px] text-white font-medium flex flex-row"
                onClick={startRecording}
                type="button"
              >
                Start Answer
                <div className="static-dot"></div>
              </button>
            ) : null}
            {recordingStatus === "recording" ? (
              <button
                className="flex flex-row items-center gap-x-[7px] py-[10px] px-[15px] bg-[#6E87ED] rounded-[10px] text-white font-medium"
                onClick={stopRecording}
                type="button"
              >
                Finish <div className="dot"></div>
              </button>
            ) : null}
            {fetchingResponse ? <div className="loader"></div> : null}
          </div>
        )}
      </main>
    </div>
  );
};

export default AudioRecorder;
