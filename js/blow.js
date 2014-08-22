window.AudioContext = window.AudioContext || window.webkitAudioContext
var audioContext = new AudioContext()
var calibrating = false
var volumeCalibrationArray = []
var calibratedVolume = 20
var buflen = 2048
var buf = new Uint8Array(buflen)

toggleLiveInput()

function getUserMedia (dictionary, callback) {
  try {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    navigator.getUserMedia(dictionary, callback, function (e) {
      console.error(e)
    })
  } catch (e) {
    alert('getUserMedia threw exception :' + e);
  }
}

function toggleLiveInput() {
  getUserMedia({ audio: true }, gotStream)
}

function gotStream (stream) {
  // Create an AudioNode from the stream.
  var mediaStreamSource = audioContext.createMediaStreamSource(stream)

  var lowPassFilter = audioContext.createBiquadFilter()
  lowPassFilter.type = 0 // Low-pass filter. See BiquadFilterNode docs
  lowPassFilter.frequency.value = 700 // Set cutoff to 440 HZ
  lowPassFilter.Q.value = 0

  var highPassFilter = audioContext.createBiquadFilter()
  highPassFilter.type = 1 // Low-pass filter. See BiquadFilterNode docs
  highPassFilter.frequency.value = 900 // Set cutoff to 440 HZ
  highPassFilter.Q.value = 0
  // Connect it to the destination.
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048

  mediaStreamSource.connect(lowPassFilter)
  lowPassFilter.connect(highPassFilter)
  highPassFilter.connect(analyser)

  listenLoop()
}

function startCalibrateVolume (cb) {
  calibrating = true
  volumeCalibrationArray = []
  setTimeout(function () {
    calibrating = false
    var sum = 0;
    for (var i = 0; i < volumeCalibrationArray.length; i++) {
        sum += parseInt(volumeCalibrationArray[i], 10)
    }
    calibratedVolume = sum/volumeCalibrationArray.length
    cb(calibratedVolume)
  }, 500)
}

function listenLoop (time, lastPitch) {
  analyser.getByteTimeDomainData(buf)
  var pitch = autoCorrelate(buf, audioContext.sampleRate)
  $('.pitch').text(pitch)
  if (lastPitch === 500 && pitch !== 500) $('.timestamp').append(Date.now() + '<br>') 

  var array = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(array)

  var volume = getAverageVolume(array)
  $('.volume').text(volume.toPrecision(2))

  if (volume > calibratedVolume) $('body').addClass('blowing')
    else $('body').removeClass('blowing')

  if (calibrating) volumeCalibrationArray.push(volume)

  if (!window.requestAnimationFrame) window.requestAnimationFrame = window.webkitRequestAnimationFrame
  window.requestAnimationFrame(function (time) {
    listenLoop(time, pitch)
  })
}

function getAverageVolume (array) {
  var values = 0;
  var average;

  var length = array.length;

  // get all the frequency amplitudes
  for (var i = 0; i < length; i++) {
    values += array[i];
  }

  average = values / length;
  return average;
}

// $('button.calibrate').on('click', function () {
//   $('body').addClass('calibrating')
//   pico.play(sinetone(500))
//   $('.calibrate-countdown').text('3')
//   setTimeout(function () {
//     $('.calibrate-countdown').text('2')
//     setTimeout(function () {
//       $('.calibrate-countdown').text('1')
//       setTimeout(function () {
//         $('.calibrate-countdown').text('')
//         pico.pause()
//       }, 1000)
//     }, 1000)
//   }, 1000)

//   setTimeout(function () {
//     $('body').removeClass('calibrating')
//     startCalibrateVolume(function (volume) {
//       $('.calibrated-volume').text(volume)
//     })
//   }, 3000)
// })

// Correlates pitch to musical note?
function autoCorrelate(buf, sampleRate) {
  var MIN_SAMPLES = 4;  // corresponds to an 11kHz signal
  var MAX_SAMPLES = 1000; // corresponds to a 44Hz signal
  var SIZE = 1000;
  var best_offset = -1;
  var best_correlation = 0;
  var rms = 0;
  var foundGoodCorrelation = false;

  if (buf.length < (SIZE + MAX_SAMPLES - MIN_SAMPLES))
    return -1;  // Not enough data

  for (var i=0;i<SIZE;i++) {
    var val = (buf[i] - 128)/128;
    rms += val*val;
  }
  rms = Math.sqrt(rms/SIZE);
  if (rms<0.01)
    return -1;

  var lastCorrelation=1;
  for (var offset = MIN_SAMPLES; offset <= MAX_SAMPLES; offset++) {
    var correlation = 0;

    for (var i=0; i<SIZE; i++) {
      correlation += Math.abs(((buf[i] - 128)/128)-((buf[i+offset] - 128)/128));
    }
    correlation = 1 - (correlation/SIZE);
    if ((correlation>0.9) && (correlation > lastCorrelation))
      foundGoodCorrelation = true;
    else if (foundGoodCorrelation) {
      // short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
      return sampleRate/best_offset;
    }
    lastCorrelation = correlation;
    if (correlation > best_correlation) {
      best_correlation = correlation;
      best_offset = offset;
    }
  }
  if (best_correlation > 0.01) {
    // console.log("f = " + sampleRate/best_offset + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
    return sampleRate/best_offset;
  }
  return -1;
//  var best_frequency = sampleRate/best_offset;
}

function sinetone(freq) {
  var phase = 0,
  phaseStep = freq / pico.samplerate;
  return {
    process: function(L, R) {
      for (var i = 0; i < L.length; i++) {
        L[i] = R[i] = Math.sin(6.28318 * phase) * 0.25;
        phase += phaseStep;
      }
    }
  };
}