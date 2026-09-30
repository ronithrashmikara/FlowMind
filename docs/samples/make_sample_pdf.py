"""Builds public/samples/Neural-Networks-Lecture-4.pdf, the sample lecture bundled with FlowMind."""
from pathlib import Path

import fitz  # PyMuPDF

OUT = Path(__file__).resolve().parents[2] / "public" / "samples" / "Neural-Networks-Lecture-4.pdf"

CSS = """
* { font-family: sans-serif; }
body { font-size: 11.5pt; line-height: 1.5; color: #1f2937; }
h1 { font-size: 20pt; color: #1e3a8a; margin-bottom: 2pt; }
h2 { font-size: 13.5pt; color: #1d4ed8; margin-top: 14pt; margin-bottom: 4pt; }
h3 { font-size: 11pt; color: #111827; margin-top: 8pt; margin-bottom: 2pt; }
p { margin-top: 3pt; margin-bottom: 5pt; text-align: justify; }
.meta { color: #6b7280; font-size: 9.5pt; }
.box { background-color: #eff6ff; padding: 6pt; border: 1px solid #bfdbfe; }
li { margin-bottom: 3pt; }
code { font-family: monospace; }
"""

HTML = """
<h1>Lecture 4: Training Neural Networks</h1>
<p class="meta">CS2140 Introduction to Machine Learning &middot; Week 4 &middot; Reading: Chapter 6</p>

<h2>1. From Neurons to Networks</h2>
<p>An <b>artificial neuron</b> is the basic unit of a neural network. It receives a vector of inputs x, multiplies each input by a <b>weight</b>, adds a <b>bias</b> term b, and passes the result through an <b>activation function</b>. The weighted sum z = w&middot;x + b is called the pre-activation. The weights determine how strongly each input influences the output, and the bias shifts the decision boundary away from the origin.</p>
<p>The <b>perceptron</b>, introduced by Frank Rosenblatt in 1958, is the simplest neural network: a single neuron with a step activation. A perceptron can only separate data that is linearly separable. It famously cannot learn the XOR function, which motivated networks with more than one layer.</p>
<p>A <b>multilayer perceptron (MLP)</b> stacks neurons into layers: an input layer, one or more <b>hidden layers</b>, and an output layer. Each neuron in one layer connects to every neuron in the next layer (a fully connected or dense layer). Computing the output of the network from the inputs, layer by layer, is called the <b>forward pass</b> or forward propagation.</p>
<p class="box">Key idea: without a non-linear activation function, any stack of layers collapses into a single linear transformation. Non-linearity is what gives deep networks their expressive power.</p>

<h2>2. Activation Functions</h2>
<p>The activation function introduces non-linearity. Three activation functions are used throughout this course:</p>
<ul>
<li><b>Sigmoid</b>: &sigma;(z) = 1 / (1 + e<sup>-z</sup>) squashes any input into the range (0, 1). It is useful for probabilities, but its gradient is at most 0.25 and approaches zero for large |z|, which causes the vanishing gradient problem in deep networks.</li>
<li><b>ReLU</b> (Rectified Linear Unit): ReLU(z) = max(0, z). ReLU is cheap to compute and its gradient is exactly 1 for positive inputs, so gradients flow well through many layers. Its weakness is the dying ReLU problem: a neuron whose input is always negative outputs zero and stops learning.</li>
<li><b>Softmax</b>: converts a vector of scores (logits) into a probability distribution that sums to 1. Softmax is used in the output layer for multi-class classification.</li>
</ul>
<p>As a rule of thumb, use ReLU in hidden layers, sigmoid for a single binary output, and softmax for multi-class outputs.</p>

<h2>3. Loss Functions</h2>
<p>A <b>loss function</b> measures how far the predictions of the network are from the true targets on the training data. Training a network means finding the weights and biases that minimise the loss.</p>
<ul>
<li><b>Mean Squared Error (MSE)</b> averages the squared difference between predictions and targets. It is the standard loss for regression tasks.</li>
<li><b>Cross-entropy loss</b> compares a predicted probability distribution with the true class. For a correct class with predicted probability p, the loss is &minus;log(p), so confident wrong predictions are penalised heavily. Cross-entropy is paired with softmax (or sigmoid) outputs for classification.</li>
</ul>
<p>The loss is a function of every weight in the network. We can picture it as a landscape over weight space; training searches this <b>loss landscape</b> for a low valley.</p>

<h2>4. Gradient Descent</h2>
<p><b>Gradient descent</b> is the optimisation algorithm used to minimise the loss. The <b>gradient</b> of the loss with respect to the weights points in the direction of steepest increase, so we update each weight a small step in the opposite direction:</p>
<p class="box"><code>w &larr; w &minus; &eta; &middot; &part;L/&part;w</code> &nbsp; where &eta; is the learning rate.</p>
<p>The <b>learning rate</b> &eta; is a hyperparameter that controls the step size. If it is too large, training diverges or oscillates around the minimum; if it is too small, training is very slow and may get stuck on plateaus. Typical starting values are 0.1 to 0.001.</p>
<h3>Batch, stochastic and mini-batch</h3>
<p><b>Batch gradient descent</b> computes the gradient on the entire training set before each update, which is accurate but slow for large datasets. <b>Stochastic gradient descent (SGD)</b> updates the weights after every single example; updates are noisy but fast, and the noise can help escape shallow local minima. <b>Mini-batch gradient descent</b> uses small batches (for example 32 to 256 examples) and is the standard in practice because it balances stable gradients with efficient use of GPU hardware. One complete pass over the training set is called an <b>epoch</b>.</p>
<p><b>Momentum</b> and adaptive optimisers such as <b>Adam</b> extend SGD. Momentum accumulates a running average of past gradients to smooth updates; Adam additionally adapts the learning rate of each weight individually.</p>

<h2>5. Backpropagation</h2>
<p>Gradient descent needs the gradient of the loss with respect to every weight. <b>Backpropagation</b> computes all of these gradients efficiently in a single backward pass through the network. It is an application of the <b>chain rule</b> from calculus: if the loss L depends on an output a, which depends on a pre-activation z, which depends on a weight w, then &part;L/&part;w = &part;L/&part;a &middot; &part;a/&part;z &middot; &part;z/&part;w.</p>
<p>The network is viewed as a <b>computational graph</b>. During the forward pass each node stores its intermediate values. During the backward pass, starting from the loss, each node multiplies the incoming gradient by its local derivative and passes the result to the nodes that fed into it. Because intermediate gradients are reused, backpropagation costs roughly the same as one forward pass, regardless of the number of weights.</p>
<p>One training step therefore has four stages: (1) forward pass to compute predictions, (2) compute the loss, (3) backward pass (backpropagation) to compute gradients, and (4) a gradient descent update of the weights.</p>
<h3>Vanishing and exploding gradients</h3>
<p>Because backpropagation multiplies many local derivatives together, gradients can shrink exponentially as they travel back through many layers. This <b>vanishing gradient problem</b> means early layers learn extremely slowly; it is severe with sigmoid activations, whose derivative is at most 0.25. The opposite, <b>exploding gradients</b>, occurs when the factors are larger than 1 and causes unstable updates. ReLU activations, careful weight initialisation (such as He or Xavier initialisation), batch normalisation and gradient clipping all reduce these problems.</p>

<h2>6. Generalisation, Overfitting and Regularisation</h2>
<p>The goal of training is not a low training loss but good performance on unseen data, called <b>generalisation</b>. Data is therefore split into a <b>training set</b> used to fit the weights, a <b>validation set</b> used to choose hyperparameters and detect overfitting, and a <b>test set</b> used once at the end to estimate real-world performance.</p>
<p><b>Overfitting</b> happens when a network memorises the training data, including its noise: the training loss keeps falling while the validation loss starts to rise. <b>Underfitting</b> is the opposite: the model is too simple, and both losses stay high. This trade-off is known as the bias-variance trade-off.</p>
<p><b>Regularisation</b> refers to techniques that reduce overfitting:</p>
<ul>
<li><b>L2 regularisation</b> (weight decay) adds a penalty proportional to the sum of squared weights to the loss, encouraging small weights and smoother functions.</li>
<li><b>Dropout</b> randomly sets a fraction of neurons (for example 50%) to zero during each training step, so the network cannot rely on any single neuron. Dropout is switched off at test time.</li>
<li><b>Early stopping</b> monitors the validation loss and stops training when it stops improving, keeping the best weights seen so far.</li>
<li><b>Data augmentation</b> enlarges the training set with transformed copies of examples, such as flipped or cropped images.</li>
</ul>

<h2>7. Summary and Checklist</h2>
<p>To train a neural network: choose an architecture and activation functions; choose a loss that matches the task; initialise weights sensibly; then repeat forward pass, loss, backpropagation and a mini-batch gradient descent update for several epochs, while monitoring validation loss to tune the learning rate and apply regularisation.</p>
<p class="box">Before next week: make sure you can (1) derive the gradient of a single sigmoid neuron with the chain rule, (2) explain why ReLU helps with vanishing gradients, and (3) read a training/validation loss curve and say whether a model is overfitting.</p>
"""


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    story = fitz.Story(html=HTML, user_css=CSS)
    writer = fitz.DocumentWriter(str(OUT))
    mediabox = fitz.paper_rect("a4")
    where = mediabox + (54, 54, -54, -60)
    more = True
    while more:
        device = writer.begin_page(mediabox)
        more, _ = story.place(where)
        story.draw(device)
        writer.end_page()
    writer.close()
    doc = fitz.open(str(OUT))
    for number, page in enumerate(doc, 1):
        page.insert_text((54, mediabox.height - 30), f"CS2140 Lecture 4 - page {number}", fontsize=8, color=(0.45, 0.45, 0.5))
    doc.saveIncr()
    print(OUT, len(doc), "pages")


if __name__ == "__main__":
    main()
