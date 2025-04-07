// --- js/character.js (or js/unit.js) ---

class Unit {
    constructor(id, config, startX, startY, team, canvasHeight) {
        this.id = `${id}_${Date.now()}_${Math.random()}`; // Unique instance ID
        this.baseId = id; // Original ID (P001, E001)
        this.team = team; // 'player' or 'enemy'

        this.maxHp = config.hp;
        this.hp = config.hp;
        this.atk = config.atk;
        this.speed = config.speed; // pixels per second
        this.attackRange = config.attackRange; // pixels
        this.attackCooldown = (60 / config.frequency) * 1000; // ms
        this.timeSinceLastAttack = this.attackCooldown; // Start ready to attack

        // Appearance (simple rectangle for MVP)
        this.width = 30;
        this.height = 50;
        this.color = (team === 'player') ? 'blue' : 'red';

        // Position
        this.x = startX;
        // Place unit on the "ground" (adjust as needed)
        this.y = canvasHeight - this.height - 10; // 10px from bottom

        this.isAlive = true;
        this.currentTarget = null; // The specific unit/base being targeted
        this.isMoving = true;
    }

    findTarget(enemyUnits, enemyBase) {
        let closestTarget = null;
        let minDistance = Infinity;
        const sightRange = this.x + (this.team === 'player' ? this.attackRange + this.width : -this.attackRange); // Forward edge + range

        // Check enemy units first
        for (const unit of enemyUnits) {
            if (!unit.isAlive) continue;

            const distance = (this.team === 'player') ? unit.x - (this.x + this.width) : this.x - (unit.x + unit.width);

            if (distance >= 0 && distance < minDistance) {
                // Check if within attack range
                if (distance <= this.attackRange) {
                    minDistance = distance;
                    closestTarget = unit;
                }
                // If not in attack range but closer than current non-attacking target
                else if (!closestTarget || minDistance > this.attackRange) {
                    minDistance = distance;
                    closestTarget = unit;
                }
            }
        }

        // If no unit target found or units are further than the base, target base if in range
        const baseDistance = (this.team === 'player') ? enemyBase.x - (this.x + this.width) : this.x - (enemyBase.x + enemyBase.width);
        if (baseDistance >= 0 && baseDistance <= this.attackRange && (!closestTarget || baseDistance < minDistance || minDistance > this.attackRange)) {
            minDistance = baseDistance;
            closestTarget = enemyBase;
        }

        this.currentTarget = closestTarget;
        // Stop moving ONLY if a target is within attack range
        this.isMoving = !(this.currentTarget && minDistance <= this.attackRange);
    }


    move(deltaTime) {
        if (!this.isMoving || !this.isAlive) return;

        const direction = (this.team === 'player') ? 1 : -1;
        // deltaTime is in seconds, speed is in pixels per second
        this.x += direction * this.speed * deltaTime;

        // Basic boundary check (prevent moving past canvas edges - adjust if bases are not at edge)
        // if (this.x < 0) this.x = 0;
        // if (this.x + this.width > canvasWidth) this.x = canvasWidth - this.width;
    }

    attack(deltaTime) {
        if (this.isMoving || !this.isAlive || !this.currentTarget) {
            this.timeSinceLastAttack += deltaTime * 1000; // Still update cooldown if not attacking
            return;
        }

        this.timeSinceLastAttack += deltaTime * 1000; // Add elapsed time in ms

        if (this.timeSinceLastAttack >= this.attackCooldown) {
            if (this.currentTarget.isAlive !== false) { // Check if target is still valid (alive or a base)
                console.log(`${this.team} unit ${this.baseId} attacks ${this.currentTarget.id || 'Base'}`);
                this.currentTarget.takeDamage(this.atk);
                this.timeSinceLastAttack = 0; // Reset cooldown timer

                // Simple attack effect placeholder
                // You could trigger a sound or visual effect here

                // Re-evaluate target immediately after attacking, maybe it died
                if(this.currentTarget.hp <= 0) {
                    this.currentTarget = null;
                    this.isMoving = true; // Start moving again if target died
                }

            } else {
                // Target died before attack landed or is no longer valid
                this.currentTarget = null;
                this.isMoving = true; // Look for new target/move
            }
        }
    }

    takeDamage(damage) {
        if (!this.isAlive) return;
        this.hp -= damage;
        // console.log(`${this.team} unit ${this.baseId} took ${damage} damage, HP: ${this.hp}`);
        if (this.hp <= 0) {
            this.hp = 0;
            this.isAlive = false;
            console.log(`${this.team} unit ${this.baseId} died.`);
            // Add dying animation/effect trigger here later
        }
    }

    update(deltaTime, enemyUnits, enemyBase) {
        if (!this.isAlive) return;

        // 1. Find Target (if no current target or current target died/out of range)
        if (!this.currentTarget || this.currentTarget.hp <= 0 || !this.currentTarget.isAlive === false) {
            this.findTarget(enemyUnits, enemyBase);
        } else {
            // Verify current target is still in range if we are not moving
            if (!this.isMoving) {
                const target = this.currentTarget;
                const distance = (this.team === 'player') ? target.x - (this.x + this.width) : this.x - (target.x + target.width);
                if (distance > this.attackRange) {
                    // Target moved out of range
                    this.currentTarget = null;
                    this.isMoving = true;
                    // Optional: Immediately run findTarget again if desired
                    // this.findTarget(enemyUnits, enemyBase);
                }
            }
        }


        // 2. Move if required
        this.move(deltaTime);

        // 3. Attack if not moving and target exists
        this.attack(deltaTime);
    }

    draw(ctx) {
        if (!this.isAlive) return;

        // Draw unit body
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Draw HP bar background
        const hpBarWidth = this.width;
        const hpBarHeight = 5;
        const hpBarX = this.x;
        const hpBarY = this.y - hpBarHeight - 2; // Position above the unit
        ctx.fillStyle = '#ddd'; // Grey background
        ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

        // Draw HP bar foreground
        const currentHpWidth = hpBarWidth * (this.hp / this.maxHp);
        ctx.fillStyle = 'green';
        ctx.fillRect(hpBarX, hpBarY, currentHpWidth, hpBarHeight);

        // Draw Attack Range (for debugging)
        // ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        // ctx.beginPath();
        // const rangeStartX = this.team === 'player' ? this.x + this.width : this.x;
        // ctx.moveTo(rangeStartX, this.y);
        // ctx.lineTo(rangeStartX + (this.team === 'player' ? this.attackRange : -this.attackRange), this.y);
        // ctx.stroke();
    }
}