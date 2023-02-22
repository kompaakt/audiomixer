import { useState, useEffect, useRef } from "react";
import { scramble } from "./scramble";
import { useForm } from "react-hook-form";
//@ts-ignore
import { clone } from "audio-buffer-utils";
import { getSVGPath, getWaveformData } from "./utils/waveform";

import "./App.css";

function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  let audioBlobRef = useRef<AudioBuffer>();
  const {
    register,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      SAMPLE_DURATION: 1000,
      VEC_SIZE: 512,
    },
  });

  const scrambleParams = watch();

  const makeScramble = async () => {
    if (!audioBlobRef.current) {
      return;
    }

    const channels = [];
    // for (let i = 0; i < audioBlobRef.current.numberOfChannels; i++) {
    //   channels[i] = audioBlobRef.current.getChannelData(i);
    // }
    // const samplesT = new Float32Array(
    //   channels.length * audioBlobRef.current.length
    // );
    // let offset = 0;
    // for (let i = 0; i < channels.length; i++) {
    //   samplesT.set(channels[i], offset);
    //   offset += audioBlobRef.current.length;
    // }
    // const buffer = samplesT.buffer;

    // navigator.serviceWorker?.controller?.postMessage({
    //   audioBlob: buffer,
    //   params: {
    //     SAMPLE_DURATION: scrambleParams.SAMPLE_DURATION,
    //     VEC_SIZE: scrambleParams.VEC_SIZE,
    //   },
    // });
    setIsProcessing(true);
    const scrambledAudio = await scramble(clone(audioBlobRef.current), {
      SAMPLE_DURATION: scrambleParams.SAMPLE_DURATION,
      VEC_SIZE: scrambleParams.VEC_SIZE,
    }).finally(() => {
      setIsProcessing(false);
    });

    const audioOuput = document.querySelector(
      "#audioOutput"
    ) as HTMLAudioElement | null;
    if (!audioOuput || !scrambledAudio) {
      return;
    }

    // const audioBlob = await fetch(scrambledAudio).then((r) => r.blob());
    // const arrayBuffer = await audioBlob.arrayBuffer();
    // const audioContext = new AudioContext();
    // const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // const svg = document.querySelector("#waveformOutput");

    // const width = svg?.getAttribute("width");
    // const height = svg?.getAttribute("height");
    // const smoothing = 2;

    // if (height && width) {
    //   svg?.setAttribute("viewBox", `0 0 ${width} ${height}`);
    //   const waveformData = getWaveformData(
    //     audioBuffer,
    //     parseInt(width) / smoothing
    //   );

    //   svg
    //     ?.querySelector("path")
    //     ?.setAttribute(
    //       "d",
    //       getSVGPath(waveformData, parseInt(height), smoothing)
    //     );

    //   const progress = svg?.querySelector("#waveformOutputProgress");
    //   const remaining = svg?.querySelector("#waveformOutputRemaining");

    //   svg?.addEventListener("click", (e) => {
    //     const position = e.offsetX / svg.getBoundingClientRect().width;
    //     audioOuput.currentTime = position * audioOuput.duration;
    //   });
    //   if (progress && remaining) {
    //     updateAudioPosition(audioOuput, parseInt(width), progress, remaining);
    //   }
    // }

    audioOuput.src = scrambledAudio;
  };

  const changeSrc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.currentTarget.files || !e.currentTarget.files[0]) {
      return;
    }

    const audio = document.querySelector(
      "#audioInput"
    ) as HTMLAudioElement | null;
    if (!audio) {
      return;
    }

    audio.src = URL.createObjectURL(new Blob([e.currentTarget.files[0]]));
    const arrayBuffer = await e.currentTarget.files[0].arrayBuffer();
    const audioContext = new AudioContext();
    const source = audioContext.createBufferSource();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // const svg = document.querySelector("#waveformInput");

    // const progress = svg?.querySelector("#progress");
    // const remaining = svg?.querySelector("#remaining");
    // const width = svg?.getAttribute("width");
    // const height = svg?.getAttribute("height");
    // const smoothing = 2;

    // if (height && width) {
    //   svg?.setAttribute("viewBox", `0 0 ${width} ${height}`);
    //   const waveformData = getWaveformData(
    //     audioBuffer,
    //     parseInt(width) / smoothing
    //   );

    //   svg
    //     ?.querySelector("path")
    //     ?.setAttribute(
    //       "d",
    //       getSVGPath(waveformData, parseInt(height), smoothing)
    //     );

    //   svg?.addEventListener("click", (e) => {
    //     const position = e.offsetX / svg.getBoundingClientRect().width;
    //     audio.currentTime = position * audio.duration;
    //   });
    //   if (progress && remaining) {
    //     updateAudioPosition(audio, parseInt(width), progress, remaining);

    //     audio.addEventListener("play", () => {
    //       if (!(audio.currentTime > 0)) {
    //         return;
    //       }

    //       updateAudioPosition(audio, parseInt(width), progress, remaining);
    //     });
    //   }
    // }

    if (audioBuffer) {
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      audioBlobRef.current = audioBuffer;
    }
  };

  return (
    <div className="App">
      <b
        style={{
          fontFamily: "chikarego2medium",
        }}
      >
        Window
      </b>
      <input
        type="file"
        accept="audio/wav"
        onChange={changeSrc}
        multiple={false}
        disabled={isProcessing}
      />

      <audio controls id="audioInput" />
      <button
        onClick={makeScramble}
        style={{
          width: "200px",
        }}
        disabled={isProcessing}
      >
        scramble
      </button>
      <audio id="audioBlob" />
      <audio controls id="audioOutput" />
      {isProcessing && <div>processing...</div>}
      <form className="controls">
        <select
          {...register("SAMPLE_DURATION", {
            valueAsNumber: true,
          })}
        >
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="300">300</option>
          <option value="500">500</option>
          <option value="1000">1000</option>
          <option value="2000">2000</option>
          <option value="3000">3000</option>
          <option value="4000">4000</option>
          <option value="5000">5000</option>
        </select>
        <select
          {...register("VEC_SIZE", {
            valueAsNumber: true,
          })}
        >
          <option value="16">16</option>
          <option value="32">32</option>
          <option value="64">64</option>
          <option value="128">128</option>
          <option value="256">256</option>
          <option value="512">512</option>
          <option value="1024">1024</option>
          <option value="2048">2048</option>
        </select>
      </form>
      <div>
        <svg
          preserveAspectRatio="none"
          width="2000"
          height="100"
          style={{ width: "900px", height: "50px" }}
          xmlns="http://www.w3.org/2000/svg"
          id="waveformInput"
        >
          <linearGradient id="Gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="white" />
            <stop offset="90%" stopColor="white" stopOpacity="0.75" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          <pattern
            id="pattern-circles"
            x="0"
            y="0"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternContentUnits="userSpaceOnUse"
          >
            <circle
              id="pattern-circle"
              cx="4"
              cy="4"
              r="1"
              fill="#000"
            ></circle>
          </pattern>

          <pattern
            id="pattern-circles-bold"
            x="0"
            y="0"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternContentUnits="userSpaceOnUse"
          >
            <circle
              id="pattern-circle"
              cx="4"
              cy="4"
              r="2"
              fill="#000"
            ></circle>
          </pattern>

          <mask id="Mask">
            <path fill="url(#Gradient)" />
          </mask>

          <rect
            id="progress"
            mask="url(#Mask)"
            x="0"
            y="0"
            width="0"
            height="100"
            fill="url(#pattern-circles-bold)"
          />
          <rect
            id="remaining"
            mask="url(#Mask)"
            x="0"
            y="0"
            width="2000"
            height="100"
            fill="url(#pattern-circles)"
          />
        </svg>
        <svg
          preserveAspectRatio="none"
          width="2000"
          height="100"
          style={{ width: "900px", height: "50px" }}
          xmlns="http://www.w3.org/2000/svg"
          id="waveformOutput"
        >
          <linearGradient
            id="waveformOutputGradient"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop offset="0%" stopColor="white" />
            <stop offset="90%" stopColor="white" stopOpacity="0.75" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="waveformOutputMask">
            <path fill="url(#pattern-circles)" />
          </mask>
          <rect
            id="waveformOutputProgress"
            mask="url(#waveformOutputMask)"
            x="0"
            y="0"
            width="0"
            height="100"
            fill="rgb(255, 106, 106)"
          />
          <rect
            id="waveformOutputRemaining"
            mask="url(#waveformOutputMask)"
            x="0"
            y="0"
            width="2000"
            height="100"
            fill="rgb(170, 56, 56)"
          />
        </svg>
      </div>
    </div>
  );
}

// function updateAudioPosition(
//   audio: HTMLAudioElement,
//   width: number,
//   progress: Element,
//   remaining: Element
// ) {
//   const { currentTime, duration, paused } = audio;

//   if (currentTime > 0 && paused) {
//     return;
//   }
//   const physicalPosition = (currentTime / duration) * width;
//   if (physicalPosition) {
//     progress.setAttribute("width", physicalPosition.toString());
//     remaining.setAttribute("x", physicalPosition.toString());
//     remaining.setAttribute("width", (width - physicalPosition).toString());
//   }
//   requestAnimationFrame(() =>
//     updateAudioPosition(audio, width, progress, remaining)
//   );
// }

export default App;
