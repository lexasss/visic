// Main script that created objects, initializes them and connects with each other.
// To be launched at the end of HTML document

(function () {
    var options = Visic.options;
    var image = new Visic.Image('image');
    image.update();
    
    var fixations = new Visic.Fixations('fixations', 'image');
        
    var synthesizer = new Visic.Synthesizer('image');
        
    var player = Visic.player;
    player.onReplay.add(function () {
        setPlayerOptions();
    });
    player.onReady.add(function () {
        //player.test();
    });

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
        synthesizer.toneSource = options.toneSource;
        synthesizer.velocitySource = options.velocitySource;
        synthesizer.durationSource = options.durationSource;
        fixations.clear();
    });
    gaze.onStopped.add(function () {
        setPlayerOptions();
        
        var sequence = synthesizer.getSequence();
        fixations.set(sequence, synthesizer.minDuration, synthesizer.minDuration + synthesizer.durationStep * 8);
        player.playSequence(sequence);
        //player.test();
    });
    
    function initOptions() {
        options.ensure();
        options.minDuration = synthesizer.minDuration;
        options.durationStep = synthesizer.durationStep;
        options.scaleFrom = synthesizer.scale.from;
        options.scaleTo = synthesizer.scale.to;
        options.toneSource = synthesizer.toneSource;
        options.velocitySource = synthesizer.velocitySource;
        options.durationSource = synthesizer.durationSource;
        options.barDuration = player.barDuration;
        options.velocity = player.velocity;
        options.volume = player.volume;
    }
    
    function setPlayerOptions() {
        player.barDuration = options.barDuration;
        player.velocity = options.velocity;
        player.volume = options.volume;
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