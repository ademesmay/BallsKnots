# BallsKnots

BallsKnots is a JavaScript applet to work with ball representations of knotted chains and cycles. It relies on three.js and Pyodide for the python scripting.

## User interface and features

* Basic 3d navigation using the mouse.
* Basic physical-based engine to enforce tangency and overlap constraints.
* A few stopper knots as presets.
* Python scripting, the api being (for now) documented as a comment in the python box.

## Local installation

To run locally, install Node.js:

```
# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# in lieu of restarting the shell
\. "$HOME/.nvm/nvm.sh"

# Download and install Node.js:
nvm install 22

# Verify the Node.js version:
node -v # Should print "v22.20.0".

# Verify npm version:
npm -v # Should print "10.9.3".
```

and then three.js and Vite (or another build tool if you prefer)

```
# three.js
npm install --save three

# vite
npm install --save-dev vite
```

Then run a Vite server with

```
npx vite
```

This will display a localhost url which you can use in your browser to access the applet.

## Build

Just run

```
npm run build
```

and you can upload the everything in the built ./dist folder to your website.


## License

GPL 3.0