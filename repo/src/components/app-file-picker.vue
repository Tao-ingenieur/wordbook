<template>
  <view><button class="primary" :disabled="busy" @click="request++">{{ busy ? '正在解析…' : '选择文件' }}</button><view :request="request" :change:request="picker.open" /></view>
</template>
<script>
export default {
  props: { busy: Boolean }, emits: ['document', 'error', 'busy'],
  data: () => ({ request: 0 }),
  methods: {
    picked(value) { this.$emit('busy', false); this.$emit('document', value); },
    failed(message) { this.$emit('busy', false); this.$emit('error', message); },
    started() { this.$emit('busy', true); }
  }
};
</script>
<script module="picker" lang="renderjs">
import { excelToEntries } from '../core/excel.mjs';
import { parseBrowserPdf } from '../platform/browser-pdf.js';
export default {
  methods: {
    open(value, previous, owner) {
      if (!value || value === previous) return;
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.xlsx,.xls,.csv,.pdf,.json';
      input.onchange = async () => {
        const file = input.files && input.files[0]; if (!file) return;
        owner.callMethod('started');
        try {
          if (file.size > 30 * 1024 * 1024) throw Error('文件超过 30 MB，请拆分后导入');
          if (/\.json$/i.test(file.name)) { owner.callMethod('picked', JSON.parse(await file.text())); return; }
          const bytes = await file.arrayBuffer();
          let entries;
          if (/\.(xlsx?|csv)$/i.test(file.name)) {
            entries = excelToEntries(bytes);
          } else if (/\.pdf$/i.test(file.name)) {
            entries = await parseBrowserPdf(bytes);
          } else throw Error('不支持此文件类型');
          owner.callMethod('picked', { name: file.name.replace(/\.[^.]+$/, ''), sourceKey: 'file:' + file.name.toLowerCase(), entries });
        } catch (error) { owner.callMethod('failed', error.message); }
      };
      input.click();
    }
  }
};
</script>
