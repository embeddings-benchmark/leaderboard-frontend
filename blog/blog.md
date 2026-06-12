# MTEB Leaderboard: From a slow demo to feature-rich leaderboard

*TL:DR*: We released a new version of MTEB that is miles faster, while improving filtering, model comparison, and transparency allows you to dig deep into which model is right for you.

<!-- TODO: FIGURE: SOME SORT OF QUICK OVERVIEW OF THE LEADERBOARD -->

Since its initial release, MTEB has had multiple benchmarks, starting from a simple table view with minimal ability to filter to a granular leaderboard. While initially reasonably fast, with the increase in both the number of models and benchmarks mteb covers then benchmark has become unreliable — both in terms of speed \[[1](https://huggingface.co/spaces/mteb/leaderboard/discussions/185), [2](https://huggingface.co/spaces/mteb/leaderboard/discussions/182), [3](https://github.com/embeddings-benchmark/mteb/issues/4411)\] and uptime \[[4](https://github.com/embeddings-benchmark/mteb/issues/4709), [5](https://github.com/embeddings-benchmark/mteb/issues/4273#issuecomment-4106896053)\]. This has been frustrating for both us as developers and the users. With this release, we are very happy to share a new leaderboard built on a more reliable and scalable framework using FastAPI and Svelte, enabling us to greatly improve the user experience — both in terms of current speed and features- and it will also enable us to deliver leaderboard improvements continually in the future.

In this blog, we will go through some of the highlights, including design decisions focusing on speed, transparency, and improved tooling to help you select more models.

<!-- TODO IMAGE: 3 version of the MTEB leaderboard (v1, v2, v3) -->


## It is fast!

To address the elephant in the room, the new leaderboard is miles faster than the previous benchmarks — we could go into details on this, but while it is important, you can find many blog posts on how to speed up a frontend, and if you want more proof, you can just go try it out — you can even explore the leaderboard and benchmarks from your phone!


## Encouraging Exploration and Customization

When selecting a benchmark, it is worth knowing that it rarely measures what you care about. A pre-defined leaderboard might only contain 50% of the tasks that you care about, and while model performance (roughly) tends to correlate across tasks, you can often do a lot better by customizing the leaderboard specifically to your use case. You can see more information about models by hovering over their names and pin models for easy comparison.

![image (1)](https://cdn-uploads.huggingface.co/production/uploads/61af4544d691b3aadd1f62b6/C01n7urmyT-xhL3KCU8ji.png)
We have now made this much easier, with benchmark filters allowing you to filter on specific domains task and modalities and with the ability to learn more about each specific task to tailor it to your needs. 
Figure 1-2: Filters allow filtering on domains, language, modality, and even individual tasks.
<div style="display: flex; gap: 8px; align-items: flex-start;">
  <img src="https://cdn-uploads.huggingface.co/production/uploads/61af4544d691b3aadd1f62b6/FV8RVY_N9pZNF7J7nn1GM.png" style="width: 50%; max-height: 300px; object-fit: contain; object-position: top left;" />
  <img src="https://cdn-uploads.huggingface.co/production/uploads/61af4544d691b3aadd1f62b6/5gD3VGloOKEZ46bNwRIJu.png" style="width: 50%; max-height: 300px; object-fit: contain; object-position: top left;" />
</div>
You can also explore models, tasks and their results!

<div style="display: flex; gap: 8px; align-items: flex-start;">
  <img src="https://cdn-uploads.huggingface.co/production/uploads/61af4544d691b3aadd1f62b6/LfdOcAVJSoI_fLLB26qFF.png" style="width: 33%; object-fit: contain;" />
  <img src="https://cdn-uploads.huggingface.co/production/uploads/61af4544d691b3aadd1f62b6/spyP77__0Yb7c1-Ls4vtx.png" style="width: 33%; object-fit: contain;" />
  <img src="https://cdn-uploads.huggingface.co/production/uploads/61af4544d691b3aadd1f62b6/46rS1BafXJWomNd52RaNJ.png" style="width: 33%; object-fit: contain;" />
</div>

But what if that is not enough? That brings us to the next section.


## Transparency

It should be easy to dig into the datasets used to evaluate our models, but many benchmarks make this hard, perhaps because they often contain errors [[6](https://arxiv.org/abs/2103.14749), [7](https://openreview.net/forum?id=SlhLRh810S&referrer=%5Bthe+profile+of+Zeyu+Tang%5D%28%2Fprofile%3Fid%3D%7EZeyu_Tang1%29), [8](https://aclanthology.org/2025.naacl-long.262/)]. However, if we want people to trust our tools, transparency is the key; the popularity of [bullshitbench](https://petergpt.github.io/bullshit-benchmark/viewer/index.v2.html) is an excellent example of this.

In the new leaderboard, we enable this by allowing you to inspect a task and by integrating a viewer for the huggingface datasets, along with the results and task metadata! 

![Screenshot 2026-06-10 at 18.18.53](https://cdn-uploads.huggingface.co/production/uploads/61af4544d691b3aadd1f62b6/hvPogCxF3rzUQZp0Lqub3.png)
![image](https://cdn-uploads.huggingface.co/production/uploads/61af4544d691b3aadd1f62b6/XDUovTqlj9f8HOvNFhqh-.png)

As you can see in the table in the figure, we also indicate whether a model has been trained on the task's training set or is seeing it for the first time (zero-shot). You will see these annotations showing up throughout the benchmarks to clearly indicate potential issues.

## Improving to the frontier not just the top

A common problem (and feature) of benchmarks is that they rank models by performance, thereby encouraging development toward better performance while ignoring other factors such as size, memory usage, and runtime. We seek to encourage broader improvements across the frontier rather than just the top models, both by ensuring that quick views of the front page display the top models for their size bracket and, of course, by providing performance-by-runtime analytics. 

![image (6)](https://cdn-uploads.huggingface.co/production/uploads/61af4544d691b3aadd1f62b6/agtIAi4jNVaQIWjijv0-2.png)
![Screenshot 2026-06-10 at 18.23.44](https://cdn-uploads.huggingface.co/production/uploads/61af4544d691b3aadd1f62b6/USL5Ll4tvZEEML4Y8iluL.png)

## Model Comparison 

The ranking can help you get a quick overview of the models, but you will soon find the need to compare two specific models for your use-case. This is now easier than ever: simply pin the models you want to compare, and they will be reordered and highlighted for easy comparison.


If you want to dig even deeper into your comparison, simply press the button stating “compare {n} pinned” and you will be shown a head-to-head comparison of the models
![image (7)](https://cdn-uploads.huggingface.co/production/uploads/61af4544d691b3aadd1f62b6/e60VlIrTCfGdAy9Z-aQSe.png)
![image (8)](https://cdn-uploads.huggingface.co/production/uploads/61af4544d691b3aadd1f62b6/y9kX0ebFFKc3kv0ZmajYA.png)

## API

If you need to fetch scores for the leaderboard locally, you can download a CSV or try our API: https://mteb-leaderboard-backend.hf.space/docs

## Thought of a good feature to add?

If you used the leaderboard or read the blog and came up with a good feature to add, feel free to suggest it as an enhancement [issue](https://github.com/embeddings-benchmark/mteb/issues). Of course, if you find bugs, we are more than happy to hear about them as well. 

A big thanks to those who have already provided feedback and improvements along the way.
