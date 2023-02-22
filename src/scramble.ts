//@ts-ignore
import { getSliverFrequencyData } from "./utils/audio";
import * as R from "ramda";
//@ts-ignore
import similarity from "compute-cosine-similarity";

type ScrambleParams = {
  SAMPLE_DURATION: number;
  VEC_SIZE: number;
};

const scramble = async (
  audioBlob: AudioBuffer,
  scrambleParams: ScrambleParams
): Promise<string> => {
  const [binSize, pfss]: any = await getProminentFrequencies(audioBlob);
  const pfss_denorm = pfss.map((e: any) =>
    e.map((v: number) => Math.floor(v * binSize))
  );

  let sampleLength = scrambleParams.SAMPLE_DURATION;
  let sliverCount = sampleLength / (SLIVER_DURATION * 1000);

  const samples = R.splitEvery(sliverCount, pfss_denorm) as [number[]];

  const maxFreq = 8000;
  console.log({ v: scrambleParams.VEC_SIZE });
  const vecSize = scrambleParams.VEC_SIZE;
  const freqStep = maxFreq / vecSize;
  const freqsForVec: number[] = [];

  let c = 0;
  while (c < maxFreq) {
    freqsForVec.push(c);
    c += freqStep;
  }

  const samplesAsVectors = samples.map((e) => {
    const sampleNormalized = [...new Set(e.flat())]
      .sort((a, b) => a - b)
      .map((v) => freqsForVec.findIndex((freq) => freq >= v));
    const t = [...new Set(sampleNormalized)];
    let vector = new Array(vecSize).fill(0);
    t.forEach((v) => {
      vector[v] = 1;
    });
    return vector;
  });

  const r: number[] = [];

  samplesAsVectors.forEach((vector1, index1) => {
    samplesAsVectors.forEach((vector2, index2) => {
      r.push(
        Math.round((similarity(vector1, vector2) + Number.EPSILON) * 100) / 100
      );
    });
  });

  const sims = R.splitEvery(samplesAsVectors.length, r);
  const replaceMap = sims
    .map((vs) =>
      vs.indexOf(Math.max(...vs.map((v) => (v !== 1 && !isNaN(v) ? v : 0))))
    )
    .map((v, index) => (v === -1 ? index : v));

  const float32Arr1 = new Float32Array(audioBlob.length);
  const float32Arr2 = new Float32Array(audioBlob.length);

  audioBlob.copyFromChannel(float32Arr1, 0, 0);
  audioBlob.copyFromChannel(float32Arr2, 1, 0);

  const float32Arr1Permut = getSelfPermutArr(
    float32Arr1,
    (audioBlob.sampleRate * sampleLength) / 1000,
    replaceMap
  );
  const float32Arr2Permut = getSelfPermutArr(
    float32Arr2,
    (audioBlob.sampleRate * sampleLength) / 1000,
    replaceMap
  );
  const audioCtx = new AudioContext();
  const myArrayBuffer = audioCtx.createBuffer(
    2,
    audioBlob.length,
    audioBlob.sampleRate
  );
  myArrayBuffer.copyToChannel(float32Arr1Permut, 0, 0);
  myArrayBuffer.copyToChannel(float32Arr2Permut, 1, 0);

  const interleaved = new Float32Array(
    float32Arr1Permut.length + float32Arr2Permut.length
  );
  for (let src = 0, dst = 0; src < float32Arr1Permut.length; src++, dst += 2) {
    interleaved[dst] = float32Arr1Permut[src];
    interleaved[dst + 1] = float32Arr2Permut[src];
  }

  // get WAV file bytes and audio params of your audio source
  const wavBytes = getWavBytes(interleaved.buffer, {
    isFloat: true, // floating point or 16-bit integer
    numChannels: 2,
    sampleRate: audioBlob.sampleRate,
  });
  const wav = new Blob([wavBytes], { type: "audio/wav" });
  return URL.createObjectURL(wav);
};

// Returns Uint8Array of WAV bytes
//@ts-ignore
function getWavBytes(buffer, options) {
  const type = options.isFloat ? Float32Array : Uint16Array;
  const numFrames = buffer.byteLength / type.BYTES_PER_ELEMENT;

  const headerBytes = getWavHeader(Object.assign({}, options, { numFrames }));
  const wavBytes = new Uint8Array(headerBytes.length + buffer.byteLength);

  // prepend header, then add pcmBytes
  wavBytes.set(headerBytes, 0);
  wavBytes.set(new Uint8Array(buffer), headerBytes.length);

  return wavBytes;
}

// adapted from https://gist.github.com/also/900023
// returns Uint8Array of WAV header bytes
//@ts-ignore
function getWavHeader(options) {
  const numFrames = options.numFrames;
  const numChannels = options.numChannels || 2;
  const sampleRate = options.sampleRate || 44100;
  const bytesPerSample = options.isFloat ? 4 : 2;
  const format = options.isFloat ? 3 : 1;

  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;

  const buffer = new ArrayBuffer(44);
  const dv = new DataView(buffer);

  let p = 0;
  function writeString(s: string) {
    for (let i = 0; i < s.length; i++) {
      dv.setUint8(p + i, s.charCodeAt(i));
    }
    p += s.length;
  }
  function writeUint32(d: number) {
    dv.setUint32(p, d, true);
    p += 4;
  }
  function writeUint16(d: number) {
    dv.setUint16(p, d, true);
    p += 2;
  }

  writeString("RIFF"); // ChunkID
  writeUint32(dataSize + 36); // ChunkSize
  writeString("WAVE"); // Format
  writeString("fmt "); // Subchunk1ID
  writeUint32(16); // Subchunk1Size
  writeUint16(format); // AudioFormat https://i.stack.imgur.com/BuSmb.png
  writeUint16(numChannels); // NumChannels
  writeUint32(sampleRate); // SampleRate
  writeUint32(byteRate); // ByteRate
  writeUint16(blockAlign); // BlockAlign
  writeUint16(bytesPerSample * 8); // BitsPerSample
  writeString("data"); // Subchunk2ID
  writeUint32(dataSize); // Subchunk2Size

  return new Uint8Array(buffer);
}

const getSelfPermutArr = (
  arr: Float32Array,
  chunkSize: number,
  map: number[]
): Float32Array => {
  let chunkedArr = [];

  for (let i = 0, j = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(map[j] * chunkSize, map[j] * chunkSize + chunkSize);
    chunkedArr.push(chunk);
    j += 1;
  }

  const newArr = arr.slice(0);

  chunkedArr.forEach((chunk, chunkIndex) => {
    chunk.forEach((v, index) => {
      newArr[chunkIndex * chunkSize + index] = v;
    });
  });

  return newArr;
};

export const getProminentFrequencies = async (audioBuffer: AudioBuffer) => {
  const binSize = audioBuffer.sampleRate / FFT_SIZE;

  const binBands = R.aperture(
    2,
    FREQUENCY_BANDS.map((f) => Math.round(f / binSize))
  );

  const sliverCount = Math.floor(audioBuffer.duration / SLIVER_DURATION);
  const sliverIndices = R.range(0, sliverCount);

  const CHUNK_SIZE = 1024;
  const chunks = R.splitEvery(CHUNK_SIZE, sliverIndices);

  const processChunk = async (chunk: any) => {
    const promises = chunk.map(async (sliverIndex: any) => {
      const frequencyData = await getSliverFrequencyData(
        audioBuffer,
        sliverIndex
      );
      return findTopBinIndices(frequencyData, binBands);
    });
    return Promise.all(promises);
  };

  const chunkResults = [];
  for (const chunk of chunks) {
    const chunkResult = await processChunk(chunk);
    chunkResults.push(chunkResult);
  }
  return [binSize, R.unnest(chunkResults)];
};

const findTopBinIndices = (frequencyData: any, binBands: any) => {
  const topBinsPairs = binBands.map(findTopBinPairInBand(frequencyData));
  const sumBinValues = topBinsPairs.reduce(
    (acc: any, [binValue]: any) => acc + binValue,
    0
  );
  const meanBinValue = sumBinValues / topBinsPairs.length;
  const threshold = Math.max(meanBinValue, MIN_BIN_VALUE);
  const filteredBinPairs = topBinsPairs.filter(
    ([binValue]: any) => binValue >= threshold
  );
  return filteredBinPairs.map(snd);
};

const MIN_BIN_VALUE = 10;

const findTopBinPairInBand =
  (frequencyData: any) =>
  ([lb, ub]: any) => {
    const array = Array.from(frequencyData);
    const zipped = zipWithIndex(array);
    const sliced = zipped.slice(lb, ub);
    const sorted = sliced.sort(
      ([binValue1]: any, [binValue2]: any) => binValue2 - binValue1
    );
    return R.head(sorted);
  };

const SLIVER_DURATION = 50 / 1000;
const FFT_SIZE = 1024;
const FREQUENCY_BANDS = [0, 100, 200, 400, 800, 1600, 3200, 6400, 8000];

export const delay = (ms: any) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const defer = async (ms: any, f: any, ...args: any) => {
  await delay(ms);
  return f(...args);
};

export const zipWithIndex = (xs: any) => xs.map(R.pair);

export const snd = ([, b]: any) => b;

export const getHashesFromProminentFrequenciesWithIndices = async (
  pfssWithIndices: any
) => {
  const TARGET_ZONE_SLIVER_GAP = 5;
  const TARGET_ZONE_NUM_POINTS = 5;

  const allTargetPoints = R.flatten(
    pfssWithIndices.map(([bins, sliverIndex]: any) =>
      bins.map((bin: any) => ({ bin, sliverIndex }))
    )
  );

  const getTargetZonePoints = (targetZoneStartSliverIndex: any) => {
    const index = allTargetPoints.findIndex(
      (targetPoint) => targetPoint.sliverIndex === targetZoneStartSliverIndex
    );
    if (index < 0) return [];
    return allTargetPoints.slice(index, index + TARGET_ZONE_NUM_POINTS);
  };

  const tuples = R.flatten(
    pfssWithIndices.map(([bins, sliverIndex]: any) =>
      bins.map((anchorPointBin: any) => {
        const targetZoneStartSliverIndex = sliverIndex + TARGET_ZONE_SLIVER_GAP;
        const targetZonePoints = getTargetZonePoints(
          targetZoneStartSliverIndex
        );
        return targetZonePoints.map((targetPoint) => {
          const f1 = anchorPointBin;
          const f2 = targetPoint.bin;
          const t1 = sliverIndex;
          const t2 = targetPoint.sliverIndex;
          const dt = t2 - t1;
          return { f1, f2, dt, t1 };
        });
      })
    )
  );

  return tuples.map(({ f1, f2, dt, t1 }) => {
    const hash = (f1 << 20) | (f2 << 8) | dt;
    return [hash, t1];
  });
};

export { scramble };
