function convertHtml2JsonAndSet() {
  const htmlTextAreaValue = document.getElementById("html").value;
  const jsonObj = html2json(htmlTextAreaValue);
  const jsonArea = document.getElementById("json");
  jsonArea.textContent = JSON.stringify(jsonObj, null, 2);
}

/*
  Update this function to convert html into json object.
  You can rewrite it completely, just be sure it accepts htmlText as string and outputs json object.
*/

function html2json(htmlText) {
  const fragments = [];
  const lowerHtmlText = htmlText.toLowerCase();
  let i = 0;

  while (i < htmlText.length) {
    if (htmlText[i] === "<") {
      const specialMatch = htmlText.slice(i).match(
        /^<\s*(script|style)(?:\s[^>]*)?>/i
      );

      if (specialMatch) {
        const fullOpenTag = specialMatch[0];
        const tagName = specialMatch[1];

        fragments.push(fullOpenTag);

        const contentStart = i + fullOpenTag.length;
        const closeTag = `</${tagName}>`;

        const closeIndex = lowerHtmlText.indexOf(
          closeTag.toLowerCase(),
          contentStart
        );

        if (closeIndex !== -1) {
          const content = htmlText.slice(
            contentStart,
            closeIndex
          );

          if (content !== "") {
            fragments.push(content);
          }

          fragments.push(
            htmlText.slice(
              closeIndex,
              closeIndex + closeTag.length
            )
          );

          i = closeIndex + closeTag.length;
          continue;
        }

        if (contentStart < htmlText.length) {
          fragments.push(
            htmlText.slice(contentStart)
          );
        }

        break;
      }

      const start = i;
      let quote = null;

      i++;

      while (i < htmlText.length) {
        if (
          quote === null &&
          (htmlText[i] === '"' || htmlText[i] === "'")
        ) {
          quote = htmlText[i];
        } else if (
          quote !== null &&
          htmlText[i] === quote
        ) {
          quote = null;
        } else if (
          quote === null &&
          htmlText[i] === ">"
        ) {
          break;
        }

        i++;
      }

      if (i >= htmlText.length) {
        break;
      }

      fragments.push(
        htmlText.slice(start, i + 1)
      );

      i++;
    } else {
      const start = i;

      while (
        i < htmlText.length &&
        htmlText[i] !== "<"
      ) {
        i++;
      }

      fragments.push(
        htmlText.slice(start, i)
      );
    }
  }

  const tokens = [];

  for (const fragment of fragments) {
    tokens.push(parseFragment(fragment));
  }

  const result = {
    children: [],
  };

  const stack = [];

  const voidTags = [
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ];

  for (const token of tokens) {
    if (token.type === "open") {
      const element = {
        tag: token.tagName,
        attributes: token.attributes,
        children: [],
      };

      const parent = stack[stack.length - 1];

      if (parent) {
        parent.children.push(element);
      } else {
        result.children.push(element);
      }

      if (
        !token.selfClosing &&
        !voidTags.includes(
          token.tagName.toLowerCase()
        )
      ) {
        stack.push(element);
      }
    } else if (token.type === "text") {
      if (token.content.trim() === "") {
        continue;
      }

      const parent = stack[stack.length - 1];

      if (parent) {
        parent.children.push({
          text: token.content.trim(),
        });
      }
    } else if (token.type === "doctype") {
      result.children.push({
        type: "doctype",
        name: token.name,
      });
    } else if (token.type === "comment") {
      const parent = stack[stack.length - 1];

      const comment = {
        type: "comment",
        content: token.content.trim(),
      };

      if (parent) {
        parent.children.push(comment);
      } else {
        result.children.push(comment);
      }
    } else if (token.type === "close") {
      const current = stack[stack.length - 1];

      if (
        current &&
        current.tag.toLowerCase() ===
          token.tagName.toLowerCase()
      ) {
        stack.pop();
      }
    }
  }

  return result;
}

function parseFragment(fragment) {
  if (fragment[0] !== "<") {
    return {
      type: "text",
      content: fragment,
    };
  }

  if (fragment.startsWith("<!--")) {
    const content = fragment.slice(4, -3);

    return {
      type: "comment",
      content,
    };
  }

  if (fragment.toLowerCase().startsWith("<!doctype")) {
    const name = fragment.slice(9, -1).trim();

    return {
      type: "doctype",
      name,
    };
  }

  if (fragment[1] === "/") {
    const tagName = fragment.slice(2, -1).trim();

    return {
      type: "close",
      tagName,
    };
  }

  let content = fragment.slice(1, -1).trim();
  let selfClosing = false;

  if (content.endsWith("/")) {
    selfClosing = true;
    content = content.slice(0, -1).trim();
  }

  const parts = [];
  let current = "";
  let quote = null;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (
      quote === null &&
      (char === '"' || char === "'")
    ) {
      quote = char;
      current += char;
      continue;
    }

    if (
      quote !== null &&
      char === quote
    ) {
      quote = null;
      current += char;
      continue;
    }

    if (
      quote === null &&
      /\s/.test(char)
    ) {
      if (current !== "") {
        parts.push(current);
        current = "";
      }

      continue;
    }

    current += char;
  }

  if (current !== "") {
    parts.push(current);
  }

  if (parts.length === 0) {
    return {
      type: "invalid",
    };
  }

  const tagName = parts[0];

  if (!/^[a-z][a-z0-9:-]*$/i.test(tagName)) {
    return {
      type: "invalid",
    };
  }

  const attributes = {};

  for (let i = 1; i < parts.length; i++) {
    const equalIndex = parts[i].indexOf("=");

    if (equalIndex === -1) {
      attributes[parts[i]] = true;
      continue;
    }

    const name = parts[i].slice(0, equalIndex);
    const value = parts[i].slice(equalIndex + 1);

    if (
      (value[0] === '"' &&
        value[value.length - 1] === '"') ||
      (value[0] === "'" &&
        value[value.length - 1] === "'")
    ) {
      attributes[name] = value.slice(1, -1);
    } else {
      attributes[name] = value;
    }
  }

  return {
    type: "open",
    tagName,
    attributes,
    selfClosing,
  };
}