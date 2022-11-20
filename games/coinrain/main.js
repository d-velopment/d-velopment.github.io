const SCENE = {
	WIDTH: 800,
	HEIGHT: 450
}

const PARTICLES = {
	FRAMETIME: 50, 			// Frame-by-frame animation base frame display time in ms 
	FRAMETIME_VARIATION: [0.8, 1.2], // Frame-by-frame animation frame time variation
	AMOUNT: 75,
	SCALE: [0.125, 0.5], 	// Coins scale variation
	BASE_DURATION: 250, 	// Base duration of the falling coin
	ROTATIONTIME: 500,		// Full rotation time for the coin in ms 

	PREDELAY_LIMIT: 1200 	// Randomly time in ms "back" before the coin appears
}

const BIGWINTEXT = {		// Demo text to put in the middle of the particles falling
	TITLE: 'BIG WIN',
	STYLE: { 
		font: 'bold 100pt Times New Roman', 
		fill: 0x000000, 
		dropShadow: true,
		dropShadowBlur: 20,
		dropShadowColor: '#ffff88',
		dropShadowDistance: 0,
		align: 'center' 
	},
	OPACITY: 0.75,
	ZINDEX: 40				// 0 to disable demo text
}

class BigWinText extends PIXI.Container {
	constructor() {
		super()

		var text = new PIXI.Text(BIGWINTEXT.TITLE, BIGWINTEXT.STYLE)
		text.pivot.x = text.width/2
		text.pivot.y = text.height/2
		text.x = SCENE.WIDTH/2
		text.y = SCENE.HEIGHT/2
		text.alpha = 0.5
		this.addChild(text)
	}
}

class Particle extends PIXI.Container {
	constructor(order) {
		super(order)

		this.timeStart = Date.now() + Math.round(Math.random() * PARTICLES.PREDELAY_LIMIT)
		
		// Set start and duration for this effect in milliseconds
		this.start    = 0
		this.frame	  = 0
		this.progress = 1
		this.rotationAngle = Math.random() * Math.PI
		this.rotationWay = Math.sign(Math.random() - 0.5)
		
		// Create a sprite
		let sp        = game.sprite("CoinsGold000")

		// Set pivot to center of said sprite
		sp.pivot.x    = sp.width/2
		sp.pivot.y    = sp.height/2

		const scale   = PARTICLES.SCALE[0] + order * (PARTICLES.SCALE[1]-PARTICLES.SCALE[0]) / PARTICLES.AMOUNT
		sp.scale.x = sp.scale.y = scale
		this.duration = (1 / scale) * PARTICLES.BASE_DURATION
		sp.x 		  = Math.random() * SCENE.WIDTH
		sp.y 		  = -sp.height

		this.frameRate = PARTICLES.FRAMETIME * PARTICLES.FRAMETIME_VARIATION[0] + PARTICLES.FRAMETIME * Math.random() * (PARTICLES.FRAMETIME_VARIATION[1]-PARTICLES.FRAMETIME_VARIATION[0])

		// Add the sprite particle to our particle effect
		this.addChild(sp)
		// Save a reference to the sprite particle
		this.sp = sp
	}
	animTick(timeProgress, timeDuration, timeGlobal) {
		// Every update we get three different time variables: timeProgress, timeDuration and timeGlobal.
		//   timeProgress: Normalized time in procentage (0.0 to 1.0) and is calculated by
		//       		   just dividing local time with duration of this effect.
		//   timeDuration: Local time in milliseconds, from 0 to this.duration.
		//   timeGlobal:   Global time in milliseconds,

		// Set a new texture on a sprite particle
		let num = ("000"+Math.floor(Math.round(timeGlobal / this.frameRate) % 8)).substr(-3)
		game.setTexture(this.sp, "CoinsGold"+num)

		// Animate position
		if (timeProgress < this.progress) 
			this.sp.x = Math.random() * SCENE.WIDTH
		this.progress = timeProgress
		this.sp.y = -this.sp.height/2 + timeProgress * (SCENE.HEIGHT + this.sp.height)
		
		// Animate rotation
		this.sp.rotation = PARTICLES.ROTATIONTIME !== 0 ? this.rotationWay * (this.rotationAngle) * timeGlobal / PARTICLES.ROTATIONTIME : 0
	}
}

class ParticleSystem {
	constructor(props) {
		this.totalDuration = 0
		this.effects = []
		this.renderer = new PIXI.WebGLRenderer(SCENE.WIDTH, SCENE.HEIGHT)
		document.body.appendChild(this.renderer.view)
		this.stage = new PIXI.Container()
		this.loadAssets(props&&props.onload)
	}
	loadAssets(cb) {
		let textureNames = []

		// Load coin assets
		for (let i=0; i<=8; i++) {
			let num  = ("000"+i).substr(-3)
			let name = "CoinsGold"+num
			let url  = "gfx/CoinsGold/"+num+".png"
			textureNames.push(name)
			PIXI.loader.add(name,url)
		}
		PIXI.loader.load(function(loader,res){
			// Access assets by name, not url
			let keys = Object.keys(res)
			for (let i=0; i<keys.length; i++) {
				var texture = res[keys[i]].texture
				if (!texture) continue
				PIXI.utils.TextureCache[keys[i]] = texture
			}
			// Assets are loaded and ready!
			this.start()
			cb && cb()
		}.bind(this));
	}
	start() {	
		this.isRunning = true
		this.timeStart = Date.now()
		update.bind(this)()
		function update(){
			if (!this.isRunning) return
			this.tick()
			this.render()
			requestAnimationFrame(update.bind(this))
		}
	}
	addEffect(effect) {
		this.totalDuration = Math.max(this.totalDuration, (effect.duration + effect.start)||0)
		this.effects.push(effect)
		this.stage.addChild(effect)
	}
	render() {
		this.renderer.render(this.stage)
	}
	tick() {
		let timeGlobal = Date.now()
		for (let i=0; i < this.effects.length; i++) {
			let thisEffect = this.effects[i]
			let timeDuration = (timeGlobal - thisEffect.timeStart) % thisEffect.duration 

			if (timeDuration > thisEffect.start + thisEffect.duration || timeDuration < thisEffect.start) 
				continue

			let estimateLeftTime = timeDuration - thisEffect.start
			let currentProgress = estimateLeftTime / thisEffect.duration
			thisEffect.animTick(currentProgress, estimateLeftTime, timeGlobal)
		}
	}
	sprite(name) {
		return new PIXI.Sprite(PIXI.utils.TextureCache[name])
	}
	setTexture(sp,name) {
		sp.texture = PIXI.utils.TextureCache[name]
		if (!sp.texture) console.warn("Texture '"+name+"' don't exist!")
	}
}

window.onload = function(){
	window.game = new ParticleSystem({onload: () => {
		for (let i=0; i < PARTICLES.AMOUNT; i++) {
			game.addEffect(new Particle(i))

			// Demo text
			if (BIGWINTEXT.ZINDEX !==0 && i == Math.min(BIGWINTEXT.ZINDEX, PARTICLES.AMOUNT-1))
				game.stage.addChild(new BigWinText())
		}
	}})
}
