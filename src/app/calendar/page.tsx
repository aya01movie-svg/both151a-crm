// 101行目付近の <li key={item.key} ...> 内の記述を以下に置き換え
              <li key={item.key} className={`flex items-start gap-3 px-4 py-3 rounded-app ${item.colorClass}`}>
                {item.emoji && <span className="text-2xl leading-none shrink-0">{item.emoji}</span>}
                <div className="min-w-0 flex-1">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-black text-info text-base hover:underline block">
                      {item.title}
                    </a>
                  ) : (
                    <p className="font-black text-navy text-base">{item.title}</p>
                  )}
                  <p className="text-sm text-navy/60 mt-0.5">{item.subtitle}</p>
                </div>
              </li>