// Event
//
// Event (class):
//   Methods:
//      add(callback: function) - add a function to the list of callbacks (does not check whether it was added already)
//      remove(callback: function) - remove a function from the list of callbacks (all instances)
//      fire(...) - fires the event by calling all callback functions added and passing all arguments to them

(function (root) { 'use strict'
    if (!root.Visic) root.Visic = { };

    function Event() {
        this._callbacks = [];
    }
    
    Event.prototype.add = function (callback) {
        if (typeof callback === 'function')
            this._callbacks.push(callback);
    }

    Event.prototype.remove = function (callback) {
        for (var i = 0; i < this._callbacks.length; i++) {
            if (this._callbacks[i] == callback) {
                this._callbacks.splice(i, 1);
                i--;
            }
        }
    }

    Event.prototype.fire = function () {
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        
        for (var i = 0; i < this._callbacks.length; i++) {
            this._callbacks[i].apply(null, args);
        }
    }
    
    root.Visic.Event = Event;

})(window);

// Manages visible fixations
//
// Fixations (class):
//   Required HTML elements:
//      #fixations - fixations container
//   Required CSS styles:
//      .fixation - fixation element
//   Properties:
//   Events:
//   Methods:
//      add(coords: {x (int), y (int)}, duration (float) - add a visual fixation with fix coords and normalized duration
//      clear() - remove all fixations
//      set([Note], minDuration, maxDuration) - display a sequence of notes, provide max/max durations for normalization

(function (root) { 'use strict'
    if (!root.Visic) root.Visic = { };
    
    function Fixations(id, imageID) {
        this.id = id;
        this.imageID = imageID;
        this.maxSize = 160;
        
        this._list = [];
        this._container = document.querySelector('#' + id);
        if (!this._container) {
            throw 'Fixation container with the ID = "' + id + '" does not exist';
        }
    }
    
    Fixations.prototype.add = function (coords, duration) {
        var size = Math.round(duration * this.maxSize);
        var fixation = document.createElement('div');
        fixation.style.width = fixation.style.height = size + 'px';
        fixation.style.left = Math.round(coords.x - size / 2) + 'px';
        fixation.style.top = Math.round(coords.y - size / 2) + 'px';
        fixation.style.borderRadius = Math.round(size / 2) + 'px';
        fixation.classList.add('fixation');
        this._container.appendChild(fixation);
        this._list.push(fixation);
    };
    
    Fixations.prototype.clear = function () {
        this._container.innerHTML = '';
        this._list = [];
    };
    
    Fixations.prototype.set = function (notes, minDuration, maxDuration) {
        this.clear();
        if (!notes)
            return;
        var minDur = minDuration || 100;
        var maxDur = maxDuration || 1000;
        for (var i = 0; i < notes.length; i++) {
            var note = notes[i];
            var duration = Math.min(1, (note.fixDuration - minDur) / (maxDur - minDur));
            this.add(note.fixCoords, duration);
        }
    };
    
    root.Visic.Fixations = Fixations;
    
})(window);

// Manages etudriver, delivers fixations
//
// gaze (object):
//   Required HTML elements:
//      #device - displays the current eye tracker, on 'not connected' if there is no connection to ETU-Driver
//      #options - button to show ETU-Driver options
//      #calibrate - button to calibrate the eye-tracking device
//      #toggle - button to start/stop data streaming from eye-tracking device
//   Required CSS styles:
//      .disabled - disables buttons
//   Events:
//      onFixationEnded(coords: {x (number), y (number)}, duration: int) - fires on fixation end, report its coords and duration
//      onStarted() - fires on tracking start
//      onStopped() - fires on tracking stop

(function (root) { 'use strict'
    if (!root.Visic) root.Visic = { };

    var gaze = {
        onFixationEnded: new root.Visic.Event(),  // args: gazepoint: {x, y}, duration_ms
        onStarted: new root.Visic.Event(),        // args: -
        onStopped: new root.Visic.Event()         // args: -
    };
    
    var fixdetTimer = null;
    var lastFixPoint = { x: 0, y: 0 };
    var lastFixDuration = 0;
    
    function init() {
        var device = document.getElementById('device');
        var options = document.getElementById('options');
        var calibrate = document.getElementById('calibrate');
        var toggle = document.getElementById('toggle');
        if (!device || !options || !calibrate || !toggle)
            throw 'Missing HTML elements for "gaze" object';

        options.addEventListener('click', function () {
            etudriver.showOptions();
        });
        calibrate.addEventListener('click', function () {
            etudriver.calibrate();
        });
        toggle.addEventListener('click', function () {
            etudriver.toggleTracking();
        });

        etudriver.init({
            panel: {
                show: false
            },
            pointer: {
                show: true
            },
        }, {
            state: function (state) {
                if (state.device) {
                    device.innerHTML = state.device;
                }
                var setDisabled = function (button, disabled) {
                    if (disabled) {
                        button.classList.add('disabled');
                    } else {
                        button.classList.remove('disabled');
                    }
                }

                setDisabled(options, !state.isServiceRunning || state.isTracking || state.isBusy);
                setDisabled(calibrate, !state.isConnected || state.isTracking || state.isBusy);
                setDisabled(toggle, !state.isCalibrated || state.isBusy);

                toggle.innerHTML = state.isTracking ? 'Stop' : 'Start';
                
                if (!fixdetTimer && state.isTracking) {
                    gaze.onStarted.fire();
                    fixdetTimer = setInterval(updateFixation, 40);
                }
                else if (fixdetTimer && !state.isTracking) {
                    clearInterval(fixdetTimer);
                    fixdetTimer = null;
                }
                
                if (state.isStopped) {
                    gaze.onStopped.fire();
                }
            }//,
            //sample: function (ts, x, y, pupil, ec) {
                //heatmap.addPoint(x, y, size, intensity/1000);
            //}
        });
    }
    
    function updateFixation() {
        var fix = etudriver.fixdet.currentFix;
        if (!fix)
            return;
        if (fix.duration < lastFixDuration) {
            gaze.onFixationEnded.fire(lastFixPoint, lastFixDuration);
        }
        
        lastFixPoint = { x: fix.x, y: fix.y };
        lastFixDuration = fix.duration;
    }
    
    if (document.readyState === 'complete') {
        init();
    }
    else {
        document.addEventListener('DOMContentLoaded', init);
    }
    
    root.Visic.gaze = gaze;
    
})(window);

// Image loader
//
// Image (class):
//   Required HTML elements:
//      #reload_{ID} - button to reload the image of the given ID
//   Properties:
//      URL (string) - the url that return a random image
//   Methods:
//      update() - updates the image

(function (root) { 'use strict'
    if (!root.Visic) root.Visic = { };
    
    function Image(id) {
        this.URL = 'http://www.splashbase.co/api/v1/images/random';
        this.id = id;
        
        this._img = document.querySelector('#' + id);
        if (!this._img) {
            throw 'Image with the ID = ' + id + ' does not exist';
        }
        else if (this._img.src === undefined) {
            throw 'The element with ID = ' + id + ' is not an image';
        }
        
        this._reload = document.getElementById('reload_' + id);
        if (!this._reload)
            throw 'Missing HTML elements for "image" object';
        
        this._reload.addEventListener('click', this.update.bind(this));
    }
    
    Image.prototype.update = function () {
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
            var resp = JSON.parse(xhr.responseText);
            if (resp.url !== undefined) {
                self._img.src = resp.url;
            }
            else if (resp.large_url !== undefined) {
                self._img.src = resp.large_url;
            }
        }
        
        xhr.open('GET', this.URL, true);
        xhr.send();
    }
    
    root.Visic.Image = Image;
    
})(window);

// Note structure 
//
// Note (class):
//   Properties:
//      name (string) - note name in standard notation, like 'C3' or 'E4#'
//      duration (float) - note note duration, 1 / 2^n : n={0..4}
//      position (int) - note position in the sequence
//      velocity (int) - note velocity
//      fixCoords {x (int), y (int)} - fixation coords
//      fixDuration (int) - fixation duration, ms

(function (root) { 'use strict'
    if (!root.Visic) root.Visic = { };

    function Note(name, duration, position, velocity, fixCoords, fixDuration) {
       this.name = name;
       this.duration = duration;
       this.position = position;
       this.velocity = velocity;
       this.fixCoords = fixCoords;
       this.fixDuration = fixDuration;
    }
        
    root.Visic.Note = Note;
    
})(window);

// Manages options values reading/writing
//
// options (object):
//   Required HTML elements:
//      #minDuration - number for synthesizer.minDuration
//      #durationStep - number for synthesizer.durationStep
//      #scaleFrom - number for synthesizer.scale.from
//      #scaleTo - number for synthesizer.scale.to
//      #toneSource - selection from Synthesizer.ToneSource for synthesizer.toneSource
//      #velocitySource - selection from Synthesizer.VelocitySource for synthesizer.velocitySource
//      #durationSource - selection from Synthesizer.DurationSource for synthesizer.durationSource
//      #barDuration - number for player.barDuration
//      #velocity - number for player.velocity
//      #volume - number for player.volume
//      input[name="alt{A-G}"] - 3 radio buttons per A-C for player.keys
//   Properties:
//      minDuration
//      durationStep
//      scaleFrom
//      scaleTo
//      toneSource
//      velocitySource
//      durationSource
//      barDuration
//      velocity
//      volume
//      alt{A-G}
//   Methods:
//      ensure(): initializes internal variables with the DOM elements

(function (root) { 'use strict'
    if (!root.Visic) root.Visic = { };
    
    var options = {
        ensure: init,
        get barDuration() { return parseInt(barDuration.value); },
        set barDuration(value) { barDuration.value = value; },
        get velocity() { return parseInt(velocity.value); },
        set velocity(value) { velocity.value = value; },
        get volume() { return parseInt(volume.value); },
        set volume(value) { volume.value = value; },
        get minDuration() { return parseInt(minDuration.value); },
        set minDuration(value) { minDuration.value = value; },
        get durationStep() { return parseInt(durationStep.value); },
        set durationStep(value) { durationStep.value = value; },
        get scaleFrom() { return parseInt(scaleFrom.value); },
        set scaleFrom(value) { scaleFrom.value = value; },
        get scaleTo() { return parseInt(scaleTo.value); },
        set scaleTo(value) { scaleTo.value = value; },
        get toneSource() { return parseInt(toneSource.value); },
        set toneSource(value) { toneSource.value = value; },
        get velocitySource() { return parseInt(velocitySource.value); },
        set velocitySource(value) { velocitySource.value = value; },
        get durationSource() { return parseInt(durationSource.value); },
        set durationSource(value) { durationSource.value = value; },
        get altC() { return parseInt(document.querySelector('input[name=altC]:checked').value); },
        get altD() { return parseInt(document.querySelector('input[name=altD]:checked').value); },
        get altE() { return parseInt(document.querySelector('input[name=altE]:checked').value); },
        get altF() { return parseInt(document.querySelector('input[name=altF]:checked').value); },
        get altG() { return parseInt(document.querySelector('input[name=altG]:checked').value); },
        get altA() { return parseInt(document.querySelector('input[name=altA]:checked').value); },
        get altB() { return parseInt(document.querySelector('input[name=altB]:checked').value); }
    };
    
    var barDuration,
        velocity,
        volume,
        minDuration,
        durationStep,
        scaleFrom,
        scaleTo,
        toneSource,
        velocitySource,
        durationSource;
    
    function init() {
        barDuration = document.getElementById('barDuration');
        velocity = document.getElementById('velocity');
        volume = document.getElementById('volume');
        minDuration = document.getElementById('minDuration');
        durationStep = document.getElementById('durationStep');
        scaleFrom = document.getElementById('scaleFrom');
        scaleTo = document.getElementById('scaleTo');
        toneSource = document.getElementById('toneSource');
        velocitySource = document.getElementById('velocitySource');
        durationSource = document.getElementById('durationSource');

        if (!barDuration || !velocity || !volume || !minDuration || !durationStep || !scaleFrom || !scaleTo || !toneSource || !velocitySource || !durationSource)
            throw 'Missing HTML elements for "options" object';
    }
    
    if (document.readyState === 'complete') {
        init();
    }
    else {
        document.addEventListener('DOMContentLoaded', init);
    }
    
    root.Visic.options = options;
    
})(window);

// Manages MIDI, plays a collection of notes
//
// player (object):
//   Required HTML elements:
//      #replay - button to replay the last sequence
//   Required CSS styles:
//      .disabled - disables buttons
//   Properties:
//      barDuration (int) - bar duration
//      velocity (int) - melody velocity
//      volume (int) - melody volume
//      keys (object) - alternated keys for the whole duration, array of pairs specific keys (no quotes, like C, D, etc) and tone change (-1 for 'b' and 1 for '#')
//   Events
//      onReady() - fires when MIDI player is ready to play
//      onReplay() - fires when the 'replay' button is pressed
//   Methods
//      isReady(): (bool) - returns true if MIDI is ready to play
//      play( noteString (string), duration (float), moveTime (bool) ) - play a specific note, ex play('C3', 1/8, true);
//      playArray( [Note] ) - play a list of notes
//      test() - test MIDI player

(function (root) { 'use strict'
    if (!root.Visic) root.Visic = { };
    
    var player = {
        
        // properties
        barDuration: 8,
        velocity: 127,
        volume: 80,
        keys: { },  // Set -1 for 'b' and 1 for '#' for the whole duration for the specific keys (no quotes, like C, D, etc)
        
        // events
        onReady: new root.Visic.Event(),
        onReplay: new root.Visic.Event(),
        
        // internal members
        _timeline: 0,
        _tempAlts: { },
        _isReady: false,
        _lastSequence: null,
        
        // public methods
        isReady: function() {
            return _isReady;
        },
        play: function(noteString, duration, moveTime, velocity) {
            if (!this._isReady)
                return;
            
            if (noteString instanceof Array) {
                playSequence(noteString);
                return;
            }
            
            var vel = velocity || this.velocity;
            if (0 < vel && vel <= 1) {
                vel = Math.round(vel * 127);
            }
            
            var noteInt = this.CalcNote(noteString);
            MIDI.noteOn(0, noteInt, vel, this._timeline);
            MIDI.noteOff(0, noteInt, vel, this._timeline + this.barDuration * duration);
            if (typeof moveTime !== 'undefined' && moveTime === true) {
                this.Move(duration);
            }
        },
        playSequence: function(notes) {
            MIDI.setVolume(0, this.volume);
            this._timeline = 0;
            this._lastSequence = notes;
            if (notes) {
                for (var i = 0; i < notes.length; i++) {
                    var note = notes[i];
                    this.play(note.name, note.duration, true, note.velocity);
                }
                replay.classList.remove('disabled');
            } 
            else {
                replay.classList.add('disabled');
            }
        },
        replay: function() {
            this.playSequence(this._lastSequence);
        },
        test: function() {
            this.play('C3', 1/8, true, 16);
            this.play('D3', 1/8, true, 32);
            this.play('E3', 1/8, true, 48);
            this.play('F3', 1/8, true, 64);
            this.play('G3', 1/8, true, 80);
            this.play('A3', 1/8, true, 96);
            this.play('B3', 1/8, true, 112);
            this.play('C4', 1/8, true, 127);
        },

        
        // internal methods
        SetReady: function(value) {
            this._isReady = value;
            if (this._isReady) {
                this.onReady.fire();
            }
        },
        Move : function(duration) {
            this._timeline += this.barDuration * duration;
            if (this.IsEndOfBar()) {
                this._tempAlts = { };
            }
        },
        CalcNote : function(noteString) {
            var note = noteString[0];
            var noteWithOctave = noteString.substring(0,2);
            var altering = this.GetAltering(noteString);
            // set altering
            if (altering) {
                this.SetTempAltering(noteWithOctave, altering);
            }
            // if temporary altering is set - start keys shouldn't be applied
            if (this._tempAlts[noteWithOctave] !== undefined) {
                return MIDI.keyToNote[noteWithOctave] + this._tempAlts[noteWithOctave];
            }
            return MIDI.keyToNote[noteWithOctave] +
                    (this.keys[note] !== undefined ? this.keys[note] : 0);
        },
        IsEndOfBar : function() {
            return !!(this._timeline % this.barDuration === 0)
        },
        GetAltering : function(noteString) {
            var altering = noteString[2];
            return altering !== undefined ? altering : false;
        },
        SetTempAltering : function(noteWithOctave, altering) {
            switch (altering) {
                case 'b': this._tempAlts[noteWithOctave] = -1; break;
                case '%': this._tempAlts[noteWithOctave] = 0;  break;
                case '#': this._tempAlts[noteWithOctave] = 1;  break;
            }
        }
    };
    
    var replay;
    
    function init() {
        MIDI.loadPlugin({
            soundfontUrl: './soundfont/',
            instrument: 'acoustic_grand_piano',
            onprogress: function(state, progress) {
                console.log(state, progress);
            },
            onsuccess: function() {
                player.SetReady(true);
            }
        });
        
        replay = document.getElementById('replay');
        if (!replay)
            throw 'Missing HTML elements for "synthesizer" object';
        
        replay.addEventListener('click', function () {
            player.onReplay.fire();
            player.replay();
        });
    }
    
    if (document.readyState === 'complete') {
        init();
    }
    else {
        document.addEventListener('DOMContentLoaded', init);
    }
    
    root.Visic.player = player;
    
})(window);

// Converts fixations to notes
//
// Synthesizer (class):
//   Properties:
//      minDuration (int, ms) - minimum fixation duration to generate a note
//      durationStep (int. ms) - the step to increase the note duration; if null, all notes has duration = 1/16
//      scale: { from (int), to (int) } - min and max note values on the scale of image height
//      toneSource (Synthesizer.ToneSource) - the data source used when calculating a note tone 
//   Methods:
//      putNote(coords: {x (number), y (number)}, duration: int) - add a note based on its coordinates and duration
//      getSequence() - return an array of the collected notes
//      reset() - reset the list of collected notes
//   Enums:
//      ToneSource = { GAZE_Y, GAZE_X } - the data source used when calculating note tone 
//      VelocitySource = { NONE, GAZE_DURATION } - the data source used when calculating note velocity
//      DurationSource = { NONE, GAZE_DURATION } - the data source used when calculating note duration

(function (root) { 'use strict'
    if (!root.Visic) root.Visic = { };

    var noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    
    function Synthesizer(imageID) {
        
        this.minDuration = 700;
        this.durationStep = 300;
        this.scale = {
            from: 14, 
            to: 28
        };
        this.toneSource = Synthesizer.ToneSource.GAZE_Y;
        this.velocitySource = Synthesizer.VelocitySource.GAZE_DURATION;
        this.durationSource = Synthesizer.DurationSource.NONE;
        
        this._notes = [];
        
        this._img = document.querySelector('#' + imageID);
        if (!this._img) {
            throw 'Image with the ID = ' + imageID + ' does not exist';
        }
        else if (this._img.src === undefined) {
            throw 'The element with ID = ' + imageID + ' is not an image';
        }
    }
    
    Synthesizer.prototype.putNote = function (coords, duration) {
        if (duration < this.minDuration)
            return;
        if (coords.x < 0 || this._img.offsetWidth < coords.x || 
            coords.y < 0 || this._img.offsetHeight < coords.y)
            return;
        
        var noteTone = this.GetTone(coords, duration);
        
        var noteValue = Math.round(this.scale.from + (this.scale.to - this.scale.from + 1) * noteTone);
        var noteName = noteNames[noteValue % 7] + (Math.floor(noteValue / 7) + 1);
        
        var noteDuration = this.GetDuration(coords, duration);
        var velocity = this.GetVelocity(coords, duration);
            
        this._notes.push(new root.Visic.Note(noteName, noteDuration, 0, velocity, coords, duration));
        console.log('new note: ', noteName, noteDuration);
    };
    
    Synthesizer.prototype.getSequence = function() {
        return this._notes.map(function (value) { return value; });
    }
    
    Synthesizer.prototype.reset = function () {
        this._notes = [];
    };
    
    // internal
    Synthesizer.prototype.GetTone = function (coords, duration) {
        var result;
        switch (this.toneSource) {
            case Synthesizer.ToneSource.GAZE_Y:
                result = 1 - coords.y / this._img.offsetHeight;
                break;
            case Synthesizer.ToneSource.GAZE_X:
                result = 1 - coords.x / this._img.offsetWidth;
                break;
            default:
                throw 'No implementation to calculate tone for the toneSource ' + this.toneSource;
        }
        return result;
    };
    
    Synthesizer.prototype.GetVelocity = function (coords, duration) {
        var result;
        switch (this.velocitySource) {
            case Synthesizer.VelocitySource.NONE:
                result = 63;
                break;
            case Synthesizer.VelocitySource.GAZE_DURATION:
                result = 15 + 16 * Math.min(7, Math.round((duration - this.minDuration) / this.durationStep));
                break;
            default:
                throw 'No implementation to calculate velocity for the velocitySource ' + this.velocitySource;
        }
        return result;
    };
    
    Synthesizer.prototype.GetDuration = function (coords, duration) {
        var result;
        switch (this.durationSource) {
            case Synthesizer.DurationSource.NONE:
                result = 1 / 16;
                break;
            case Synthesizer.DurationSource.GAZE_DURATION:
                result = this.GetProgressiveDuration(duration);
                break;
            default:
                throw 'No implementation to calculate duration for the durationSource ' + this.durationSource;
        }
        return result;
    };
    
    Synthesizer.prototype.GetProgressiveDuration = function (duration) {
        var durSteps = Math.floor((duration - this.minDuration) / this.durationStep);
        var result = 1;
        if (durSteps < 1)
            result = 1 / 16;
        else if (durSteps < 2)
            result = 1 / 8;
        else if (durSteps < 4)
            result = 1 / 4;
        else if (durSteps < 8)
            result = 1 / 2;
        return result;
    };
    
    // enums
    Synthesizer.ToneSource = {
        GAZE_Y: 0,
        GAZE_X: 1
    };
    Synthesizer.VelocitySource = {
        NONE: 0,
        GAZE_DURATION: 1
    };
    Synthesizer.DurationSource = {
        NONE: 0,
        GAZE_DURATION: 1
    };
    
    root.Visic.Synthesizer = Synthesizer;
    
})(window);