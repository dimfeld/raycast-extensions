import tempy from "tempy";
import { useState, useEffect } from "react";
import { exec } from "child_process";
import { existsSync, readFile } from "fs";
import { getDashAppBundleId, getDashAppPath } from "./dashApp";

export type Docset = {
  docsetBundle: string;
  docsetName: string;
  docsetPath: string;
  docsetKeyword: string;
  keyword: string;
  pluginKeyword: string;
};

export function useDocsets(searchText: string): [Docset[], string | null, boolean] {
  const [isLoading, setLoading] = useState<boolean>(true);
  const [docsets, setDocsets] = useState<Docset[]>([]);
  const [filteredDocsets, setFilteredDocsets] = useState<Docset[]>([]);
  const [exactMatchKeyword, setExactMatchKeyword] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getDocsets().then((docsets) => {
      setDocsets(docsets);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const searchLower = searchText.toLowerCase();
    const filtered = docsets.filter(
      (docset) =>
        docset.docsetName.toLowerCase().includes(searchLower) ||
        docset.docsetKeyword.toLowerCase().includes(searchLower)
    );

    const exactMatch = filtered.find(
      (docset) => docset.docsetKeyword.toLowerCase() === searchLower || docset.docsetName.toLowerCase() === searchLower
    );

    setFilteredDocsets(exactMatch ? [exactMatch] : filtered);

    const firstSearchToken = searchLower.split(/[ :]/, 1)[0];
    const firstTokenMatch = docsets.find(
      (docset) =>
        docset.docsetName.toLowerCase() === firstSearchToken || docset.docsetKeyword.toLowerCase() === firstSearchToken
    );
    setExactMatchKeyword(firstTokenMatch?.docsetKeyword ?? null);
  }, [searchText]);

  return [searchText.length ? filteredDocsets : docsets, exactMatchKeyword, isLoading];
}

export function getDocsets(): Promise<Docset[]> {
  return new Promise((resolve, reject) => {
    const filename = tempy.file({ extension: ".json" });

    getDashAppBundleId().then((bundleId) => {
      exec(`defaults read ${bundleId} docsets | plutil -convert json -r -o ${filename} -`, (err) => {
        if (err) {
          return reject(err);
        }

        readFile(filename, "utf8", (err, data) => {
          if (err) {
            return reject(err);
          }

          const docSets = JSON.parse(data).map((docset: Docset) => {
            function stripColon(s: string): string {
              return s.substr(s.length - 1) === ":" ? s.substr(0, s.length - 1) : s;
            }

            return {
              ...docset,
              docsetKeyword:
                "keyword" in docset
                  ? stripColon(docset.keyword)
                  : "pluginKeyword" in docset
                  ? stripColon(docset.pluginKeyword)
                  : stripColon(docset.docsetBundle),
            };
          });

          resolve(docSets);
        });
      });
    });
  });
}

export async function getDocsetIconPath(docset: Docset): Promise<string> {
  const dashAppPath = await getDashAppPath();

  return (
    [
      `${docset.docsetPath}/icon@2x.png`,
      `${docset.docsetPath}/icon.png`,
      `${docset.docsetPath}/icon.tiff`,
      `${dashAppPath}/Contents/Resources/${docset.docsetBundle}.tiff`,
    ].find(existsSync) || "list-icon.png"
  );
}
