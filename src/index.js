import './blob';
import { getTextWidth, addDays, getMinDate, getMaxDate, formatDate, getMouseXY, hitsElement } from './utils';

const DAY = 24 * 60 * 60 * 1000;
const TYPE = {
  day: DAY,
  week: DAY * 7,
  month: DAY * 30
};

/**
 * data:
 * [{
 *   id: 1,
 *   name: 'group name',
 *   collapse: true | false,
 *   children: [{
 *     id: 11,
 *     name: 'task name',
 *     from: new Date(2015, 9, 10),
 *     to: new Date(2015, 10, 20),
 *     percent: [0 ~ 100]
 *   }]
 * }]
 */

export default class Gantt {
  constructor(domId, data = [], options = {}) {
    this.data = data;
    this.options = Object.assign({
      type: 'day',
      fontSize: 14,
      fontFamily: 'Helvetica Neue,Helvetica,PingFang SC,Hiragino Sans GB,Microsoft YaHei,SimSun,sans-serif',
      pad: 10,
      padX: 10,
      padY: 10,
      cellWidth: 28,
      cellHeight: 28,
      color: '#555',
      lineColor: '#e9e9e9',
      hColor: '#999',
      barColor1: '#2db7f5',
      barColor2: '#87d068',
      barBgColor: '#e9e9e9'
    }, options);

    this.options.font = this.options.fontSize + 'px ' + this.options.fontFamily;
    this.root = document.getElementById(domId);
    this.preHandle();
    this.layout();
    this.render();
    this.initBind();
  }
  setType(t) {
    this.options.type = t;
    this.layout();
    this.render();
  }
  setData(data) {
    this.data = data;
    this.preHandle();
    this.layout();
    this.render();
  }
  toBlob(callback, type, quality) {
    this.root.toBlob(callback, type, quality);
  }
  initBind() {
    const self = this;
    const { pad } = this.options;
    this.root.addEventListener('click', function(e) {
      let { x, y } = getMouseXY(this, e);
      let isHit = false;
      self.data.forEach(function(group) {
        if (hitsElement(group, x - pad, y - pad)) {
          isHit = true;
          group.collapse = !group.collapse;
        }
      });
      if (isHit) {
        self.preHandle();
        self.layout();
        self.render();
      }
    }, false);
  }
  preHandle() {
    const { font, padX } = this.options;

    let maxDate = null;
    let minDate = null;
    let textWidth = 0;

    let row = 0;

    this.data.forEach((group) => {
      let width = getTextWidth(group.name, 'bold ' + font);
      textWidth = Math.max(width, textWidth);
      row++;

      let minD = null;
      let maxD = null;
      let percent = 0;
      group.children.forEach((item) => {
        if (!group.collapse) {
          let width = getTextWidth(item.name, 'bold ' + font);
          textWidth = Math.max(width, textWidth);
          row++;
        }

        percent += item.percent || 0;
        minD = getMinDate(minD, item.from);
        maxD = getMaxDate(maxD, item.to);
      });

      minDate = getMinDate(minDate, minD);
      maxDate = getMaxDate(maxDate, maxD);

      group.percent = percent / group.children.length;
      group.from = minD;
      group.to = maxD;
    });
    // Default set 30 days
    minDate = minDate || new Date();
    maxDate = maxDate || addDays(minDate, 30);
    // set time zero
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(24, 0, 0, 0);

    this.row = row;
    this.minDate = minDate;
    this.maxDate = maxDate;
    // add text padding
    this.textWidth = textWidth + padX * 2;
  }
  layout() {
    const { row, minDate, maxDate, textWidth } = this;
    const { type, fontSize, pad, padY, cellWidth, cellHeight } = this.options;
    const H = fontSize + padY * 2;
    const col = Math.ceil((maxDate - minDate) / TYPE[type]);

    this.col = col;
    this.width = cellWidth * col + textWidth;
    this.height = cellHeight * 2 + row * H;
    // resize canvas
    this.root.width = this.width + pad * 2;
    this.root.height = this.height + pad * 2;
    this.ctx = this.root.getContext('2d');
  }
  render() {
    const { ctx, width, height, row, col, textWidth, minDate, maxDate } = this;
    const { type, font, cellWidth, cellHeight, pad, padX, padY, fontSize } = this.options;
    const { color, lineColor, hColor, barColor1, barColor2, barBgColor } = this.options;
    const H = fontSize + padY * 2;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width + pad * 2, height + pad * 2);
    ctx.translate(pad, pad);

    // 1. Draw outlines
    ctx.strokeStyle = lineColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.moveTo(textWidth, 0);
    ctx.lineTo(textWidth, height);
    ctx.moveTo(0, cellHeight * 2);
    ctx.lineTo(width, cellHeight * 2);
    ctx.moveTo(textWidth, cellHeight);
    ctx.lineTo(width, cellHeight);
    for (let i = 1; i < col; i++) {
      let x = textWidth + i * cellWidth;
      ctx.moveTo(x, cellHeight);
      ctx.lineTo(x, height);
    }
    ctx.stroke();
    // 2. Draw header text
    ctx.font = font;
    ctx.fillStyle = hColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    if (type === 'day') {
      const counts = {};
      const dates = [];
      for (let i = 0; i < col; i++) {
        const cur = addDays(minDate, i);
        const key = formatDate(cur, 'YYYY-MM');
        if (counts[key]) {
          counts[key] = counts[key] + 1;
        } else {
          counts[key] = 1;
          dates.push(cur);
        }
        ctx.fillText(cur.getDate(), textWidth + (i + 0.5) * cellWidth, cellHeight * 1.5);
      }
      let offset = textWidth;
      for (let d of dates) {
        const key = formatDate(d, 'YYYY-MM');
        const count = counts[key];
        ctx.fillText(count > 2 ? key : key.slice(-2), offset + (count / 2) * cellWidth, cellHeight / 2);

        offset += count * cellWidth;

        ctx.beginPath();
        ctx.strokeStyle = lineColor;
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset, cellHeight);
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < col; i++) {
        ctx.fillText(i + 1, textWidth + (i + 0.5) * cellWidth, cellHeight * 1.5);
      }
      for (let i = 0; i + 4 <= col; i += 4) {
        const d = type === 'week' ? 7 : 30;
        const s = addDays(minDate, i * d);
        const e = addDays(minDate, (i + 4) * d - 1);
        const str = formatDate(s, 'MM-dd') + ' ~ ' + formatDate(e, 'MM-dd');
        ctx.fillText(str, textWidth + (i + 2) * cellWidth, cellHeight / 2);

        const offset = textWidth + (i + 4) * cellWidth;
        ctx.beginPath();
        ctx.strokeStyle = lineColor;
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset, cellHeight);
        ctx.stroke();
      }
    }
    const diff = (new Date() - minDate) / TYPE[type];
    if (diff > 0) {
      const offset = textWidth + diff * cellWidth;
      ctx.strokeStyle = '#f50';
      ctx.beginPath();
      ctx.moveTo(offset, cellHeight * 2);
      ctx.lineTo(offset, height);
      ctx.stroke();
    }
    // 3. Draw left side & progress
    let offsetY = cellHeight * 2;
    this.data.forEach((group) => {
      function progress(v, c) {
        let s = (v.from - minDate) / TYPE[type];
        let d = (v.to - v.from) / TYPE[type];
        let x = textWidth + s * cellWidth;
        let y = offsetY + (H - 12) / 2;
        let w = d * cellWidth;
        ctx.fillStyle = barBgColor;
        ctx.fillRect(x, y, w, 12);
        if (v.percent) {
          ctx.fillStyle = c;
          ctx.fillRect(x, y, w * v.percent / 100, 12);
        }
      }
      ctx.font = `bold ${font}`;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.fillText(group.name, padX, offsetY + H / 2);
      // Set group position for hit test
      group.x = 0;
      group.y = offsetY;
      group.width = textWidth;
      group.height = H;

      if (group.from && group.to) {
        progress(group, barColor1);
      }
      offsetY += H;

      if (!group.collapse) {
        group.children.forEach((item) => {
          ctx.font = font;
          ctx.fillStyle = color;
          ctx.fillText(item.name, padX, offsetY + H / 2);
          if (item.from && item.to) {
            progress(item, barColor2);
          }
          offsetY += H;
        });
      }
      ctx.beginPath();
      ctx.strokeStyle = lineColor;
      ctx.moveTo(0, offsetY);
      ctx.lineTo(width, offsetY);
      ctx.stroke();
    });
    // reset current transformation matrix to the identity matrix
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
