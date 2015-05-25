// Main script that created objects, initializes them and connects with each other.
// To be launched at the end of HTML document

(function () {
    var options = Visic.options;
    var image = new Visic.Image('image');
    image.update();
        
    var synthesizer = new Visic.Synthesizer('image');
        
    var player = Visic.player;
    player.onReplay.add(function () {
        setPlayerOptions();
    });
    //player.onReady.add(function () {
        //player.test();
    //});

    var gaze = Visic.gaze;
    gaze.onFixationEnded.add(function (coords, duration) {
        synthesizer.putNote(coords, duration);
    });
    gaze.onStarted.add(function () {
        synthesizer.reset();
        synthesizer.minDuration = options.minDuration;
        synthesizer.durationStep = options.durationStep;
        synthesizer.scale.from = options.scaleFrom;
        synthesizer.scale.to = options.scaleTo;
        synthesizer.direction = options.direction;
    });
    gaze.onStopped.add(function () {
        setPlayerOptions();
        player.playSequence(synthesizer.getSequence());
        //player.test();
    });
    
    function initOptions() {
        options.ensure();
        options.minDuration = synthesizer.minDuration;
        options.durationStep = synthesizer.durationStep;
        options.scaleFrom = synthesizer.scale.from;
        options.scaleTo = synthesizer.scale.to;
        options.direction = synthesizer.direction;
        options.barDuration = player.barDuration;
        options.velocity = player.velocity;
    }
    
    function setPlayerOptions() {
        player.barDuration = options.barDuration;
        player.velocity = options.velocity;
        player.keys = {
            C: options.altC,
            D: options.altD,
            E: options.altE,
            F: options.altF,
            G: options.altG,
            A: options.altA,
            B: options.altB
        };
    }

    if (document.readyState === 'complete') {
        initOptions();
    }
    else {
        document.addEventListener('DOMContentLoaded', initOptions);
    }
    
})();