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
//   Properties:
//      URL (string) - the url that return a random image
//   Methods:
//      update() - updates the image

(function (root) { 'use strict'
    if (!root.Visic) root.Visic = { };
    
    var img = null;
    
    function Image(id) {
        this.URL = 'http://www.splashbase.co/api/v1/images/random';
        
        img = document.querySelector('#' + id);
        if (!img) {
            throw 'Image with the ID = ' + id + ' does not exist';
        }
        else if (img.src === undefined) {
            throw 'The element with ID = ' + id + ' is not an image';
        }
    }
    
    Image.prototype.update = function () {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var resp = JSON.parse(xhr.responseText);
                if (resp.url !== undefined) {
                    img.src = resp.url;
                }
                else if (resp.large_url !== undefined) {
                    img.src = resp.large_url;
                }
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

(function (root) { 'use strict'
    if (!root.Visic) root.Visic = { };

    function Note(name, duration, position) {
       this.name = name;
       this.duration = duration;
       this.position = position;
    }
        
    root.Visic.Note = Note;
    
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
//      keys (object) - alternated keys for the whole duration, array of pairs specific keys (no quotes, like C, D, etc) and tone change (-1 for 'b' and 1 for '#')
//   Events
//      onReady() - fires when MIDI player is ready to play
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
        keys: { },  // Set -1 for 'b' and 1 for '#' for the whole duration for the specific keys (no quotes, like C, D, etc)
        
        // events
        onReady: new root.Visic.Event(),
        
        // internal members
        _timeline: 0,
        _tempAlts: { },
        _isReady: false,
        _lastSequence: null,
        
        // public methods
        isReady: function() {
            return _isReady;
        },
        play: function(noteString, duration, moveTime) {
            if (!this._isReady)
                return;
            
            if (noteString instanceof Array) {
                playSequence(noteString);
                return;
            }
            
            var noteInt = this.CalcNote(noteString);
            MIDI.noteOn(0, noteInt, this.velocity, this._timeline);
            MIDI.noteOff(0, noteInt, this.velocity, this._timeline + this.barDuration * duration);
            if (typeof moveTime !== 'undefined' && moveTime === true) {
                this.Move(duration);
            }
        },
        playSequence: function(notes) {
            MIDI.setVolume(0, 80);
            this._timeline = 0;
            this._lastSequence = notes;
            if (notes) {
                for (var i = 0; i < notes.length; i++) {
                    var note = notes[i];
                    this.play(note.name, note.duration, true);
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
            this.play('C3', 1/8, true);
            this.play('D3', 1/8, true);
            this.play('E3', 1/8, true);
            this.play('F3', 1/8, true);
            this.play('G3', 1/8, true);
            this.play('A3', 1/8, true);
            this.play('B3', 1/8, true);
            this.play('C4', 1/8, true);
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
//      direction (Synthesizer.Directions) - the dimension used when calculating a note tone 
//      notes ([Note]) - all notes collected so far;
//   Methods:
//      putNote(coords: {x (number), y (number)}, duration: int) - add a note based on its coordinates and duration
//      reset() - reset the list of collected notes
//   Enums:
//      Direction = { VERTICAL, HORIZONTAL } - the dimension used when calculating a note tone 

(function (root) { 'use strict'
    if (!root.Visic) root.Visic = { };

    var noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    
    function Synthesizer(imageID) {
        
        this.minDuration = 1000;
        this.durationStep = 500;
        this.scale = {
            from: 14, 
            to: 28
        };
        this.direction = Synthesizer.Directions.VERTICAL;
        this.notes = [];
        
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
        
        var normalizedTone;
        switch (this.direction) {
            case Synthesizer.Directions.VERTICAL:
                normalizedTone = 1 - coords.y / this._img.offsetHeight;
                break;
            case Synthesizer.Directions.HORIZONTAL:
                normalizedTone = 1 - coords.x / this._img.offsetWidth;
                break;
            default:
                throw 'No implementation to calculate a tone for the direction ' + this.direction;
        }
        
        var noteValue = Math.round(this.scale.from + (this.scale.to - this.scale.from + 1) * normalizedTone);
        var noteName = noteNames[noteValue % 7] + (Math.floor(noteValue / 7) + 1);
        
        var noteDuration = this.durationStep > 0 ? this.GetProgressiveDuration(duration) : 1 / 16;
            
        this.notes.push(new root.Visic.Note(noteName, noteDuration, 0));
        console.log('new note: ', noteName, noteDuration);
    };
    
    Synthesizer.prototype.reset = function () {
        this.notes = [];
    };
    
    // internal
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
    }
    
    // enums
    Synthesizer.Directions = {
        VERTICAL: 0,
        HORIZONAL: 1
    };
    
    root.Visic.Synthesizer = Synthesizer;
    
})(window);