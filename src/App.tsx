{/* 個人修改 PIN 碼彈窗 (底線視覺回饋 + 自動跳轉) */}
      {isChangePinOpen && (() => {
        // 輔助函數：渲染 4 碼底線與星號
        const renderPinSlots = (pin: string, isActive: boolean) => {
          const slots = [];
          for (let i = 0; i < 4; i++) {
            if (i < pin.length) {
              // 已輸入：顯示 *
              slots.push(<span key={i} className={isActive ? "text-[#4A3D32]" : "text-[#998D80]"}>*</span>);
            } else {
              // 未輸入：顯示 _ (若為當前焦點則加上閃爍動畫)
              const isCurrent = isActive && i === pin.length;
              slots.push(
                <span key={i} className={isCurrent ? "text-[#6E5D4F] animate-pulse font-bold" : "text-[#D4C9BC]"}>
                  _
                </span>
              );
            }
          }
          return <div className="flex gap-1.5 justify-center tracking-widest font-mono text-[13px] mt-0.5">{slots}</div>;
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2521]/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#E6E1D8]">
              <div className="px-5 py-4 bg-[#2B2521] text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#D4C9BC]" />
                  <h3 className="font-bold text-base">修改個人 PIN 碼</h3>
                </div>
                <button onClick={() => setIsChangePinOpen(false)} className="text-[#C4B8AB] hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleChangePinSubmit} className="p-5 space-y-3">
                <div className="text-xs text-[#54473C] bg-[#FAF8F5] p-2.5 rounded-xl border border-[#E6E1D8]">
                  當前人員：<span className="font-bold text-[#2B2521]">{currentEmployee.name}</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => setActivePinField('old')}
                    className={`p-2 rounded-xl border transition-all ${
                      activePinField === 'old'
                        ? 'border-[#6E5D4F] bg-[#EAE3DA] ring-2 ring-[#D4C9BC]'
                        : 'border-[#E6E1D8] bg-[#FAF8F5]'
                    }`}
                  >
                    <div className={`text-[11px] font-bold ${activePinField === 'old' ? 'text-[#4A3D32]' : 'text-[#706458]'}`}>舊密碼</div>
                    {renderPinSlots(oldPin, activePinField === 'old')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePinField('new')}
                    className={`p-2 rounded-xl border transition-all ${
                      activePinField === 'new'
                        ? 'border-[#6E5D4F] bg-[#EAE3DA] ring-2 ring-[#D4C9BC]'
                        : 'border-[#E6E1D8] bg-[#FAF8F5]'
                    }`}
                  >
                    <div className={`text-[11px] font-bold ${activePinField === 'new' ? 'text-[#4A3D32]' : 'text-[#706458]'}`}>新密碼</div>
                    {renderPinSlots(newPin, activePinField === 'new')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePinField('confirm')}
                    className={`p-2 rounded-xl border transition-all ${
                      activePinField === 'confirm'
                        ? 'border-[#6E5D4F] bg-[#EAE3DA] ring-2 ring-[#D4C9BC]'
                        : 'border-[#E6E1D8] bg-[#FAF8F5]'
                    }`}
                  >
                    <div className={`text-[11px] font-bold ${activePinField === 'confirm' ? 'text-[#4A3D32]' : 'text-[#706458]'}`}>再次確認</div>
                    {renderPinSlots(confirmNewPin, activePinField === 'confirm')}
                  </button>
                </div>

                {changePinError && <div className="text-xs text-rose-600 font-semibold text-center">{changePinError}</div>}
                {changePinSuccess && <div className="text-xs text-emerald-600 font-semibold text-center">✅ 密碼修改成功！已儲存至雲端。</div>}

                <VirtualKeypad
                  onDigit={(d) => {
                    setChangePinError('');
                    if (activePinField === 'old') {
                      if (oldPin.length < 4) {
                        const nextVal = oldPin + d;
                        setOldPin(nextVal);
                        // 打滿 4 碼自動跳下一格
                        if (nextVal.length === 4) setActivePinField('new');
                      }
                    } else if (activePinField === 'new') {
                      if (newPin.length < 4) {
                        const nextVal = newPin + d;
                        setNewPin(nextVal);
                        // 打滿 4 碼自動跳下一格
                        if (nextVal.length === 4) setActivePinField('confirm');
                      }
                    } else if (activePinField === 'confirm') {
                      if (confirmNewPin.length < 4) {
                        setConfirmNewPin(confirmNewPin + d);
                      }
                    }
                  }}
                  onDelete={() => {
                    setChangePinError('');
                    if (activePinField === 'old') setOldPin((p) => p.slice(0, -1));
                    if (activePinField === 'new') setNewPin((p) => p.slice(0, -1));
                    if (activePinField === 'confirm') setConfirmNewPin((p) => p.slice(0, -1));
                  }}
                  onClear={() => {
                    setChangePinError('');
                    if (activePinField === 'old') setOldPin('');
                    if (activePinField === 'new') setNewPin('');
                    if (activePinField === 'confirm') setConfirmNewPin('');
                  }}
                />

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsChangePinOpen(false)}
                    className="flex-1 py-2 text-xs font-semibold text-[#706458] border border-[#E6E1D8] rounded-xl hover:bg-[#F6F3EE]"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-bold text-white bg-[#6E5D4F] hover:bg-[#5C4D40] rounded-xl shadow-xs"
                  >
                    確認修改
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
