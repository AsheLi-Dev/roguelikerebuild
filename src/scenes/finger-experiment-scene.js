import { getMetaState, craftFinger, rerollFingerMod, equipFinger, unequipAllFingers, addFingerEssence } from '../systems/finger-experiment-meta.js';
import { getModById } from '../data/finger-experiment-mods.js';
import { getStartingFingerCount } from '../systems/fingers.js';
import { resolveModValue } from '../systems/finger-experiment-runtime.js';

export function createFingerExperimentScene(game) {
  const state = {
    selectedFingerId: null,
    message: '',
    messageTimer: 0,
    scrollOffset: 0
  };

  return {
    id: 'finger-experiment',
    update(dt) {
      if (state.messageTimer > 0) {
        state.messageTimer -= dt;
        if (state.messageTimer <= 0) state.message = '';
      }

      if (game.input.wasPressed('escape')) {
        game.showStartMenu();
      }
    },
    render(ctx) {
      const { width, height } = game.canvas;
      const meta = getMetaState();
      const startingFingerCount = getStartingFingerCount();
      let hoveredFinger = null;

      // Background
      ctx.fillStyle = 'rgba(20, 20, 25, 0.95)';
      ctx.fillRect(0, 0, width, height);

      // Header
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FINGER EXPERIMENT', width / 2, 60);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px monospace';
      ctx.fillText(`Essence: ${Math.floor(meta.fingerEssence)} | Starting Slots: ${startingFingerCount}`, width / 2, 90);

      // Layout Constants
      const listX = 50;
      const listY = 130;
      const listWidth = 400;
      const listHeight = height - 250;
      const detailX = 500;
      const detailY = 130;
      const detailWidth = 600;

      // Inventory List Clipping
      ctx.save();
      ctx.beginPath();
      ctx.rect(listX - 10, listY - 10, listWidth + 20, listHeight + 20);
      ctx.clip();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('CRAFTED FINGERS', listX, listY - 20 - state.scrollOffset);

      if (meta.craftedFingers.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '14px monospace';
        ctx.fillText('(No fingers crafted yet)', listX, listY + 20);
      } else {
        meta.craftedFingers.forEach((finger, i) => {
          const y = listY + i * 45 - state.scrollOffset;
          
          // Visibility check
          if (y < listY - 50 || y > listY + listHeight + 50) return;

          let slotIndex = -1;
          for (const sIdx in meta.equippedStartingFingers) {
            if (meta.equippedStartingFingers[sIdx] === finger.id) {
              slotIndex = parseInt(sIdx);
              break;
            }
          }

          const isEquipped = slotIndex >= 0;
          const isSelected = state.selectedFingerId === finger.id;
          const isHovered = game.input.mouse.x > listX && game.input.mouse.x < listX + listWidth &&
                            game.input.mouse.y > y && game.input.mouse.y < y + 40;
          
          if (isHovered) hoveredFinger = finger;

          if (isSelected) {
            ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
            ctx.fillRect(listX - 5, y - 2, listWidth + 10, 44);
          }

          ctx.fillStyle = isEquipped ? '#22c55e' : (isHovered ? '#475569' : '#334155');
          ctx.fillRect(listX, y, listWidth, 40);
          
          ctx.fillStyle = '#ffffff';
          ctx.font = '14px monospace';
          ctx.fillText(`${finger.name}`, listX + 10, y + 25);
          
          if (isEquipped) {
            ctx.fillStyle = '#052e16';
            ctx.textAlign = 'right';
            ctx.fillText(`SLOT ${slotIndex + 1}`, listX + listWidth - 10, y + 25);
            ctx.textAlign = 'left';
          }

          if (isHovered && game.input.mouse.clicked) {
            state.selectedFingerId = finger.id;
          }
        });
      }
      ctx.restore();

      // Scrollbar (Slider)
      const totalContentHeight = meta.craftedFingers.length * 45;
      if (totalContentHeight > listHeight) {
        const scrollbarX = listX + listWidth + 5;
        const scrollbarWidth = 8;
        const ratio = listHeight / totalContentHeight;
        const thumbHeight = listHeight * ratio;
        const thumbY = listY + (state.scrollOffset / totalContentHeight) * listHeight;

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(scrollbarX, listY, scrollbarWidth, listHeight);
        
        const barHover = game.input.mouse.x > scrollbarX - 10 && game.input.mouse.x < scrollbarX + 20 &&
                         game.input.mouse.y > listY && game.input.mouse.y < listY + listHeight;
        
        ctx.fillStyle = barHover ? '#94a3b8' : '#475569';
        ctx.fillRect(scrollbarX, thumbY, scrollbarWidth, thumbHeight);

        if (barHover && game.input.mouse.down) {
          const mouseY = game.input.mouse.y - listY;
          const p = mouseY / listHeight;
          state.scrollOffset = p * totalContentHeight - listHeight / 2;
          state.scrollOffset = Math.max(0, Math.min(state.scrollOffset, totalContentHeight - listHeight));
        }
      }

      // Details Panel
      const activeFinger = meta.craftedFingers.find(f => f.id === state.selectedFingerId) || hoveredFinger;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(detailX, detailY, detailWidth, 550);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(detailX, detailY, detailWidth, 550);

      if (activeFinger) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(activeFinger.name.toUpperCase(), detailX + 20, detailY + 40);

        // Mod Slots
        const slots = [
          { label: 'MAIN', key: 'mainMod', color: '#60a5fa' },
          { label: 'AUXILIARY', key: 'auxiliaryMod', color: '#facc15' },
          { label: 'HERO', key: 'heroMod', color: '#c084fc' },
          { label: 'CURSE', key: 'curseMod', color: '#ef4444' }
        ];

        slots.forEach((slot, idx) => {
          const sy = detailY + 80 + idx * 90;
          ctx.fillStyle = slot.color;
          ctx.font = 'bold 14px monospace';
          ctx.fillText(slot.label, detailX + 20, sy);

          const modId = activeFinger[slot.key];
          let mod = modId ? (game.resolvedFingerMods?.[modId] || getModById(modId)) : null;

          if (mod) {
            if (slot.key === 'curseMod') {
              mod = resolveModValue(mod, activeFinger.curseValue);
            }
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px monospace';
            ctx.fillText(mod.name, detailX + 30, sy + 25);
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '14px monospace';
            ctx.fillText(mod.description, detailX + 30, sy + 45);

            // Small Reroll per slot
            if (state.selectedFingerId === activeFinger.id) {
              const rx = detailX + detailWidth - 120;
              const ry = sy + 10;
              const rHover = game.input.mouse.x > rx && game.input.mouse.x < rx + 100 &&
                             game.input.mouse.y > ry && game.input.mouse.y < ry + 30;
              
              ctx.fillStyle = rHover ? '#475569' : '#334155';
              ctx.fillRect(rx, ry, 100, 30);
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.font = '12px monospace';
              ctx.fillText('REROLL', rx + 50, ry + 20);
              ctx.textAlign = 'left';

              if (rHover && game.input.mouse.clicked) {
                const res = rerollFingerMod(activeFinger.id, slot.label.toLowerCase());
                if (res.ok) state.message = `${slot.label} rerolled!`;
                else state.message = 'Need Essence!';
                state.messageTimer = 1.5;
              }
            }
          } else {
            ctx.fillStyle = '#475569';
            ctx.font = 'italic 14px monospace';
            ctx.fillText('(Empty Slot)', detailX + 30, sy + 25);
          }
        });

        // Equip/Unequip at Bottom of Details
        if (state.selectedFingerId === activeFinger.id) {
          let currentSlot = -1;
          for (const sIdx in meta.equippedStartingFingers) {
            if (meta.equippedStartingFingers[sIdx] === activeFinger.id) {
              currentSlot = parseInt(sIdx);
              break;
            }
          }
          const isEquipped = currentSlot >= 0;
          const eqX = detailX + 20;
          const eqY = detailY + 480;
          const eqW = detailWidth - 40;
          const eqH = 40;
          const eqHover = game.input.mouse.x > eqX && game.input.mouse.x < eqX + eqW &&
                          game.input.mouse.y > eqY && game.input.mouse.y < eqY + eqH;
          
          ctx.fillStyle = eqHover ? (isEquipped ? '#ef4444' : '#22c55e') : (isEquipped ? '#b91c1c' : '#166534');
          ctx.fillRect(eqX, eqY, eqW, eqH);
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.font = 'bold 18px monospace';
          ctx.fillText(isEquipped ? 'UNEQUIP' : 'EQUIP TO STARTING LOADOUT', eqX + eqW/2, eqY + 26);
          ctx.textAlign = 'left';

          if (eqHover && game.input.mouse.clicked) {
            if (isEquipped) {
              equipFinger(null, currentSlot);
              state.message = 'Unequipped';
            } else {
              let targetSlot = -1;
              for (let s = 0; s < startingFingerCount; s++) {
                if (!meta.equippedStartingFingers[s]) { targetSlot = s; break; }
              }
              if (targetSlot >= 0) {
                equipFinger(activeFinger.id, targetSlot);
                state.message = `Equipped to Slot ${targetSlot + 1}`;
              } else state.message = 'No empty slots!';
            }
            state.messageTimer = 1.5;
          }
        }
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#475569';
        ctx.font = '16px monospace';
        ctx.fillText('Select a finger to see details', detailX + detailWidth/2, detailY + 250);
      }

      // Main Actions: Craft & Unequip All
      const buttonY = height - 60;
      const craftX = width / 2 - 130;
      const unequipX = width / 2 + 130;
      const btnW = 240;
      const btnH = 40;

      const craftHover = game.input.mouse.x > craftX - btnW/2 && game.input.mouse.x < craftX + btnW/2 &&
                         game.input.mouse.y > buttonY - btnH/2 && game.input.mouse.y < buttonY + btnH/2;
      
      const unequipHover = game.input.mouse.x > unequipX - btnW/2 && game.input.mouse.x < unequipX + btnW/2 &&
                           game.input.mouse.y > buttonY - btnH/2 && game.input.mouse.y < buttonY + btnH/2;

      // Draw Craft
      ctx.fillStyle = craftHover ? '#eab308' : '#ca8a04';
      ctx.fillRect(craftX - btnW/2, buttonY - btnH/2, btnW, btnH);
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('CRAFT (100 Essence)', craftX, buttonY + 7);

      // Draw Unequip All
      ctx.fillStyle = unequipHover ? '#475569' : '#1e293b';
      ctx.fillRect(unequipX - btnW/2, buttonY - btnH/2, btnW, btnH);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(unequipX - btnW/2, buttonY - btnH/2, btnW, btnH);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('UNEQUIP ALL', unequipX, buttonY + 7);

      if (craftHover && game.input.mouse.clicked) {
        const result = craftFinger();
        if (result.ok) {
          state.message = `Crafted ${result.finger.name}`;
          state.selectedFingerId = result.finger.id;
          state.messageTimer = 2;
        } else state.message = 'Insufficient Essence!';
      }

      if (unequipHover && game.input.mouse.clicked) {
        unequipAllFingers();
        state.message = 'All fingers unequipped';
        state.messageTimer = 2;
      }

      if (state.message) {
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'center';
        ctx.font = '16px monospace';
        ctx.fillText(state.message, width / 2, height - 110);
      }

      // Back hint
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.font = '14px monospace';
      ctx.fillText('Press ESC to return to Menu | Scroll list with mouse/slider', width / 2, height - 20);

      if (game.input.wasPressed('f')) {
        addFingerEssence(500);
        state.message = '+500 Essence';
        state.messageTimer = 1;
      }
    }
  };
}
