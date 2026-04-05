import { getMetaState, craftFinger, rerollFingerMod, equipFinger, addFingerEssence } from '../systems/finger-experiment-meta.js';
import { getModById } from '../data/finger-experiment-mods.js';
import { getStartingFingerCount } from '../systems/fingers.js';

export function createFingerExperimentScene(game) {
  const state = {
    selectedFingerId: null,
    message: '',
    messageTimer: 0
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
      const detailX = 500;
      const detailY = 130;
      const detailWidth = 550;

      // Inventory List
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('CRAFTED FINGERS', listX, listY - 20);

      ctx.font = '14px monospace';
      if (meta.craftedFingers.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.fillText('(No fingers crafted yet)', listX, listY + 20);
      } else {
        meta.craftedFingers.forEach((finger, i) => {
          const y = listY + i * 45;
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

          // Selection highlight
          if (isSelected) {
            ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
            ctx.fillRect(listX - 5, y - 2, listWidth + 10, 44);
          }

          ctx.fillStyle = isEquipped ? '#22c55e' : (isHovered ? '#475569' : '#334155');
          ctx.fillRect(listX, y, listWidth, 40);
          
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${finger.name}`, listX + 10, y + 25);
          
          if (isEquipped) {
            ctx.fillStyle = '#052e16';
            ctx.textAlign = 'right';
            ctx.fillText(`SLOT ${slotIndex + 1}`, listX + listWidth - 10, y + 25);
            ctx.textAlign = 'left';
          }

          // Click to select
          if (isHovered && game.input.mouse.clicked) {
            state.selectedFingerId = finger.id;
          }
        });
      }

      // Resolve which finger to show in details
      const activeFinger = meta.craftedFingers.find(f => f.id === state.selectedFingerId) || hoveredFinger;

      // Details Panel
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(detailX, detailY, detailWidth, 400);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(detailX, detailY, detailWidth, 400);

      if (activeFinger) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(activeFinger.name.toUpperCase(), detailX + 20, detailY + 40);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px monospace';
        ctx.fillText(`Rarity: ${activeFinger.rarity.toUpperCase()}`, detailX + 20, detailY + 65);

        const modId = activeFinger.mods?.auxiliaryModId;
        const mod = modId ? getModById(modId) : null;

        if (mod) {
          ctx.fillStyle = '#60a5fa';
          ctx.font = 'bold 12px monospace';
          ctx.fillText(mod.category.toUpperCase(), detailX + 20, detailY + 85);

          // Mod Display
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 18px monospace';
          ctx.fillText('MODS:', detailX + 20, detailY + 120);

          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 16px monospace';
          ctx.fillText(`• ${mod.name}`, detailX + 30, detailY + 150);
          
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '14px monospace';
          ctx.fillText(`  ${mod.description}`, detailX + 30, detailY + 175);

          if (mod.tags) {
            ctx.fillStyle = '#475569';
            ctx.font = '12px monospace';
            ctx.fillText(`Tags: ${mod.tags.join(', ')}`, detailX + 30, detailY + 200);
          }

          // --- ACTION BUTTONS ---
          // Only show action buttons for SELECTED finger (not just hovered preview)
          if (state.selectedFingerId === activeFinger.id) {
            let currentSlot = -1;
            for (const sIdx in meta.equippedStartingFingers) {
              if (meta.equippedStartingFingers[sIdx] === activeFinger.id) {
                currentSlot = parseInt(sIdx);
                break;
              }
            }

            // EQUIP / UNEQUIP BUTTON
            const equipX = detailX + 20;
            const equipY = detailY + 240;
            const equipWidth = 200;
            const equipHover = game.input.mouse.x > equipX && game.input.mouse.x < equipX + equipWidth &&
                               game.input.mouse.y > equipY && game.input.mouse.y < equipY + 40;
            
            const isEquipped = currentSlot >= 0;
            ctx.fillStyle = equipHover ? (isEquipped ? '#ef4444' : '#22c55e') : (isEquipped ? '#b91c1c' : '#166534');
            ctx.fillRect(equipX, equipY, equipWidth, 40);
            
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.font = 'bold 16px monospace';
            ctx.fillText(isEquipped ? 'UNEQUIP' : 'EQUIP FINGER', equipX + equipWidth/2, equipY + 25);
            ctx.textAlign = 'left';

            if (equipHover && game.input.mouse.clicked) {
              if (isEquipped) {
                equipFinger(null, currentSlot);
                state.message = `Unequipped ${activeFinger.name}`;
                state.messageTimer = 1.5;
              } else {
                let targetSlot = -1;
                for (let s = 0; s < startingFingerCount; s++) {
                  if (!meta.equippedStartingFingers[s]) { targetSlot = s; break; }
                }
                if (targetSlot >= 0) {
                  equipFinger(activeFinger.id, targetSlot);
                  state.message = `Equipped to slot ${targetSlot + 1}`;
                  state.messageTimer = 1.5;
                } else {
                  state.message = 'No empty slots!';
                  state.messageTimer = 1.5;
                }
              }
            }

            // REROLL BUTTON
            const rerollX = detailX + 240;
            const rerollY = detailY + 240;
            const rerollWidth = 200;
            const rerollHover = game.input.mouse.x > rerollX && game.input.mouse.x < rerollX + rerollWidth &&
                                game.input.mouse.y > rerollY && game.input.mouse.y < rerollY + 40;
            
            ctx.fillStyle = rerollHover ? '#334155' : '#1e293b';
            ctx.fillRect(rerollX, rerollY, rerollWidth, 40);
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 2;
            ctx.strokeRect(rerollX, rerollY, rerollWidth, 40);
            
            ctx.fillStyle = '#e2e8f0';
            ctx.textAlign = 'center';
            ctx.font = '14px monospace';
            ctx.fillText(`REROLL (${50} Essence)`, rerollX + rerollWidth/2, rerollY + 25);
            ctx.textAlign = 'left';

            if (rerollHover && game.input.mouse.clicked) {
              const res = rerollFingerMod(activeFinger.id);
              if (res.ok) {
                state.message = 'Mod rerolled!';
                state.messageTimer = 1.5;
              } else if (res.reason === 'insufficientEssence') {
                state.message = 'Need 50 Essence!';
                state.messageTimer = 1.5;
              }
            }
          }
        } else {
          ctx.fillStyle = '#64748b';
          ctx.fillText('No active mods found.', detailX + 30, detailY + 140);
        }

        ctx.fillStyle = '#64748b';
        ctx.font = 'italic 12px monospace';
        ctx.fillText('Select a finger from the list to manage', detailX + 20, detailY + 380);
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#475569';
        ctx.font = '16px monospace';
        ctx.fillText('Click a finger to see details and equip', detailX + detailWidth/2, detailY + 175);
      }

      // Main Action: Craft Button
      const buttonY = height - 100;
      const craftHover = game.input.mouse.x > width / 2 - 100 && game.input.mouse.x < width / 2 + 100 &&
                         game.input.mouse.y > buttonY - 20 && game.input.mouse.y < buttonY + 20;
      
      ctx.fillStyle = craftHover ? '#eab308' : '#ca8a04';
      ctx.fillRect(width / 2 - 100, buttonY - 20, 200, 40);
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('CRAFT (100 Essence)', width / 2, buttonY + 7);

      if (craftHover && game.input.mouse.clicked) {
        const result = craftFinger();
        if (result.ok) {
          state.message = `Crafted: ${result.finger.name}`;
          state.selectedFingerId = result.finger.id; // Auto-select new finger
          state.messageTimer = 2;
        } else {
          state.message = 'Not enough Essence!';
          state.messageTimer = 2;
        }
      }

      // Message display
      if (state.message) {
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'center';
        ctx.font = '16px monospace';
        ctx.fillText(state.message, width / 2, buttonY + 50);
      }

      // Back hint
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.font = '14px monospace';
      ctx.fillText('Press ESC to return to Menu', width / 2, height - 30);

      // DEBUG: Secret essence gain
      if (game.input.wasPressed('f')) {
        addFingerEssence(100);
        state.message = '+100 Essence (Cheat)';
        state.messageTimer = 1;
      }
    }
  };
}
