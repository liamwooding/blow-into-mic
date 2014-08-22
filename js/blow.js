window.AudioContext = window.AudioContext || window.webkitAudioContext
var audioContext = new AudioContext()
var calibrating = false
var volumeCalibrationArray = []
var calibratedVolume = 20

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

  var filter = audioContext.createBiquadFilter()
  filter.type = 0 // Low-pass filter. See BiquadFilterNode docs
  filter.frequency.value = 440 // Set cutoff to 440 HZ
  // Connect it to the destination.
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048

  mediaStreamSource.connect(filter)
  filter.connect(analyser)

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

function listenLoop (time) {
  var array = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(array)

  var volume = getAverageVolume(array)
  $('.volume').text(volume.toPrecision(2))

  if (volume > calibratedVolume) $('body').addClass('blowing')
    else $('body').removeClass('blowing')

  if (calibrating) volumeCalibrationArray.push(volume)

  if (!window.requestAnimationFrame) window.requestAnimationFrame = window.webkitRequestAnimationFrame
  window.requestAnimationFrame(listenLoop)
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

$('button.calibrate').on('click', function () {
  $('body').addClass('calibrating')

  $('.calibrate-countdown').text('3')
  setTimeout(function () {
    $('.calibrate-countdown').text('2')
    setTimeout(function () {
      $('.calibrate-countdown').text('1')
      setTimeout(function () {
        $('.calibrate-countdown').text('')
      }, 1000)
    }, 1000)
  }, 1000)

  setTimeout(function () {
    $('body').removeClass('calibrating')
    startCalibrateVolume(function (volume) {
      $('.calibrated-volume').text(volume)
    })
  }, 3000)
})