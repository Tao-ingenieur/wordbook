// Android Storage Access Framework：让用户选择实际导出位置，无存储权限要求。
export function saveAndroidDocument(name, text) {
  return new Promise((resolve, reject) => {
    const Intent = plus.android.importClass('android.content.Intent');
    const Writer = plus.android.importClass('java.io.OutputStreamWriter');
    const activity = plus.android.runtimeMainActivity();
    const previous = activity.onActivityResult;
    const requestCode = 17361;
    activity.onActivityResult = (request, result, data) => {
      if (request !== requestCode) { if (previous) previous(request, result, data); return; }
      activity.onActivityResult = previous;
      if (result !== -1 || !data) { resolve(false); return; }
      let writer;
      try {
        plus.android.importClass(data);
        const uri = data.getData();
        const resolver = activity.getContentResolver();
        plus.android.importClass(resolver);
        const stream = resolver.openOutputStream(uri);
        writer = new Writer(stream, 'UTF-8');
        writer.write(text); writer.flush(); writer.close();
        resolve(true);
      } catch (error) { try { writer?.close(); } catch {} reject(Error('导出失败：' + error.message)); }
    };
    try {
      const intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
      intent.addCategory(Intent.CATEGORY_OPENABLE);
      intent.setType('application/json'); intent.putExtra(Intent.EXTRA_TITLE, name);
      activity.startActivityForResult(intent, requestCode);
    } catch (error) { activity.onActivityResult = previous; reject(Error('无法打开系统保存窗口：' + error.message)); }
  });
}
