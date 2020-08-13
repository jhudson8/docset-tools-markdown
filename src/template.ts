export interface Options {
  prefix: string;
  content: string;
}

export default ({ prefix, content }: Options) => {
  return `
    <!DOCTYPE HTML>
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0"/>
        <link media="all" rel="stylesheet" href="${prefix}/css/github-markdown.min.css" type="text/css" />
        <link media="all" rel="stylesheet" href="${prefix}/css/markdown-highlight.min.css" type="text/css" />
      </head>
      <body style="margin: 0">
        <div class="markdown-body" style="margin: 0 auto; padding: 0 40px">
          ${content}
        </div>
      </body>
    </html>
  `;
};
