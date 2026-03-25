import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Crest Protocol", function () {
    let crestEvents: any;
    let crestCore: any;
    let mockEAS: any;
    let owner: any;
    let organizer: any;
    let user1: any;
    let schemaUid: string;

    beforeEach(async function () {
        [owner, organizer, user1] = await ethers.getSigners();

        // Deploy Mock EAS
        const MockEAS = await ethers.getContractFactory("MockEAS");
        mockEAS = await MockEAS.deploy();
        await mockEAS.waitForDeployment();

        // Deploy CrestEvents
        const CrestEvents = await ethers.getContractFactory("CrestEvents");
        crestEvents = await CrestEvents.deploy();
        await crestEvents.waitForDeployment();

        // Deploy CrestCore
        schemaUid = ethers.keccak256(ethers.toUtf8Bytes("CrestAttendanceSchema"));
        const CrestCore = await ethers.getContractFactory("CrestCore");
        crestCore = await CrestCore.deploy(mockEAS.target, crestEvents.target, schemaUid);
        await crestCore.waitForDeployment();
    });

    describe("CrestEvents Primitive", function () {
        it("Should register an event correctly", async function () {
            const startTime = (await time.latest()) + 60; // 1 min from now
            const endTime = startTime + 3600; // 1 hour duration
            const ipfsHash = "ipfs://QmTz...";

            await expect(crestEvents.connect(organizer).registerEvent(startTime, endTime, ipfsHash, ethers.keccak256(ethers.toUtf8Bytes("secretcode"))))
                .to.emit(crestEvents, "EventRegistered")
                .withArgs(1, organizer.address, startTime, endTime, ipfsHash, ethers.keccak256(ethers.toUtf8Bytes("secretcode")));

            const eventData = await crestEvents.events(1);
            expect(eventData.startTime).to.equal(startTime);
            expect(eventData.endTime).to.equal(endTime);
            expect(eventData.organizer).to.equal(organizer.address);
            expect(eventData.ipfsHash).to.equal(ipfsHash);
            expect(eventData.passcodeHash).to.equal(ethers.keccak256(ethers.toUtf8Bytes("secretcode")));
        });

        it("Should fail if start time is past end time", async function () {
            const startTime = (await time.latest()) + 3600;
            const endTime = startTime - 60;

            await expect(crestEvents.connect(organizer).registerEvent(startTime, endTime, "hash", ethers.keccak256(ethers.toUtf8Bytes("secretcode"))))
                .to.be.revertedWithCustomError(crestEvents, "InvalidTimeWindow");
        });

        it("Should fail if start time is in the past", async function () {
            const startTime = (await time.latest()) - 60; // 1 min in the past
            const endTime = startTime + 3600;

            await expect(crestEvents.connect(organizer).registerEvent(startTime, endTime, "hash", ethers.keccak256(ethers.toUtf8Bytes("secretcode"))))
                .to.be.revertedWithCustomError(crestEvents, "InvalidTimeWindow");
        });

        it("Should correctly report if an event is active", async function () {
            const startTime = (await time.latest()) + 3600; // starts in 1 hour
            const endTime = startTime + 3600; // lasts for 1 hour

            await crestEvents.connect(organizer).registerEvent(startTime, endTime, "hash", ethers.keccak256(ethers.toUtf8Bytes("secretcode")));

            // Event 1 created. Hasn't started yet.
            expect(await crestEvents.isEventActive(1)).to.be.false;

            // Fast forward to during the event
            await time.increaseTo(startTime + 60);
            expect(await crestEvents.isEventActive(1)).to.be.true;

            // Fast forward to after the event
            await time.increaseTo(endTime + 1);
            expect(await crestEvents.isEventActive(1)).to.be.false;
        });

        it("Should revert isEventActive for non-existent events", async function () {
            await expect(crestEvents.isEventActive(999))
                .to.be.revertedWithCustomError(crestEvents, "EventNotFound");
        });

        describe("Update Passcode", function () {
            it("Should allow the organizer to update the passcode", async function () {
                const startTime = (await time.latest()) + 3600;
                const endTime = startTime + 3600;
                await crestEvents.connect(organizer).registerEvent(startTime, endTime, "hash", ethers.keccak256(ethers.toUtf8Bytes("oldcode")));

                const newPasscodeHash = ethers.keccak256(ethers.toUtf8Bytes("newcode"));

                await expect(crestEvents.connect(organizer).updatePasscode(1, newPasscodeHash))
                    .to.emit(crestEvents, "PasscodeUpdated")
                    .withArgs(1, newPasscodeHash);

                const eventData = await crestEvents.events(1);
                expect(eventData.passcodeHash).to.equal(newPasscodeHash);
            });

            it("Should fail to update passcode if not the organizer", async function () {
                const startTime = (await time.latest()) + 3600;
                const endTime = startTime + 3600;
                await crestEvents.connect(organizer).registerEvent(startTime, endTime, "hash", ethers.keccak256(ethers.toUtf8Bytes("oldcode")));

                const newPasscodeHash = ethers.keccak256(ethers.toUtf8Bytes("newcode"));

                await expect(crestEvents.connect(user1).updatePasscode(1, newPasscodeHash))
                    .to.be.revertedWithCustomError(crestEvents, "NotEventOrganizer");
            });

            it("Should fail to update passcode for non-existent event", async function () {
                const newPasscodeHash = ethers.keccak256(ethers.toUtf8Bytes("newcode"));
                await expect(crestEvents.connect(organizer).updatePasscode(999, newPasscodeHash))
                    .to.be.revertedWithCustomError(crestEvents, "EventNotFound");
            });
        });
    });

    describe("CrestCore State Machine and Cooldowns", function () {
        let eventId1: number = 1;
        let eventId2: number = 2;
        let eventId3: number = 3;
        let eventId4: number = 4;

        beforeEach(async function () {
            const now = await time.latest();
            const startTime = now + 60;
            // Register multiple ongoing/future events
            // eventId 1: active immediately for a long time
            await crestEvents.connect(organizer).registerEvent(startTime, startTime + 1000000, "hash1", ethers.keccak256(ethers.toUtf8Bytes("secretcode")));
            // eventId 2,3,4
            await crestEvents.connect(organizer).registerEvent(startTime, startTime + 1000000, "hash2", ethers.keccak256(ethers.toUtf8Bytes("secretcode")));
            await crestEvents.connect(organizer).registerEvent(startTime, startTime + 1000000, "hash3", ethers.keccak256(ethers.toUtf8Bytes("secretcode")));
            await crestEvents.connect(organizer).registerEvent(startTime, startTime + 1000000, "hash4", ethers.keccak256(ethers.toUtf8Bytes("secretcode")));
            // fast forward to start time
            await time.increaseTo(startTime);
        });

        it("Dormant user should claim and become Active (Tier 1)", async function () {
            expect(await crestCore.userTiers(user1.address)).to.equal(0); // Dormant

            const tx = await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1", "secretcode");

            await expect(tx).to.emit(crestCore, "TierUpgraded")
                .withArgs(user1.address, 0, 1);

            expect(await crestCore.userTiers(user1.address)).to.equal(1); // Active
        });

        it("Active user should hit 1 hour cooldown", async function () {
            // First claim -> Becomes active
            await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1", "secretcode");

            // Attempt second claim immediately on different event
            await expect(crestCore.connect(user1).claimAttendance(eventId2, 0, "hash2", "secretcode"))
                .to.be.revertedWithCustomError(crestCore, "CooldownActive");

            // Fast forward 1 hour
            await time.increase(3600); // 1 hour

            // Successful claim
            await expect(crestCore.connect(user1).claimAttendance(eventId2, 0, "hash2", "secretcode"))
                .to.not.be.reverted;
        });

        it("Active user should become Ascended after 10 attendances", async function () {
            // We need 10 distinct events to do 10 attendances. 
            // We'll create another 6 events quickly inside this test just for this
            const now = await time.latest();
            const futureStart = now + 60;
            for (let i = 5; i <= 10; i++) {
                await crestEvents.connect(organizer).registerEvent(futureStart, futureStart + 1000000, "hash_extra", ethers.keccak256(ethers.toUtf8Bytes("secretcode")));
            }
            await time.increaseTo(futureStart); // Advance to start time

            let currentEventId = 1;

            // Do 9 attendances
            for (let i = 0; i < 9; i++) {
                await crestCore.connect(user1).claimAttendance(currentEventId++, 0, "hashx", "secretcode");
                await time.increase(3600); // Wait 1 hour between claims
            }

            expect(await crestCore.userTiers(user1.address)).to.equal(1); // Still Active

            // 10th Attendance -> Upgrade to Ascended
            const tx10 = await crestCore.connect(user1).claimAttendance(currentEventId, 0, "hashx", "secretcode");

            await expect(tx10).to.emit(crestCore, "TierUpgraded")
                .withArgs(user1.address, 1, 2);

            expect(await crestCore.userTiers(user1.address)).to.equal(2); // Ascended
        });

        it("Active user should decay to Dormant after 30 days of inactivity", async function () {
            // Claim once to become Active
            await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1", "secretcode");
            expect(await crestCore.userTiers(user1.address)).to.equal(1); // Active

            // Fast forward 31 days
            await time.increase(31 * 24 * 60 * 60);

            // Our original events from the beforeEach block expired after 11.5 days (1,000,000 seconds)
            // We need to create a brand new active event to claim attendance for this final part of the test
            const newNow = await time.latest();
            const newStart = newNow + 60;
            await crestEvents.connect(organizer).registerEvent(newStart, newStart + 1000000, "hash_new", ethers.keccak256(ethers.toUtf8Bytes("secretcode")));
            await time.increaseTo(newStart); // Advance to start time

            // They try to claim attendance on this newly registered event (which will have ID 5)
            const tx = await crestCore.connect(user1).claimAttendance(5, 0, "hash_new", "secretcode");

            // The claim triggers the decay process, dropping them to Dormant, then processing the claim to make them Active again
            await expect(tx).to.emit(crestCore, "TierDowngraded").withArgs(user1.address, 1, 0); // Decayed
            // After being downgraded to Dormant, the claim immediately makes them Active again
            await expect(tx).to.emit(crestCore, "TierUpgraded").withArgs(user1.address, 0, 1);

            // Their tier is now Active, but their attendanceCount was reset to 1
            expect(await crestCore.attendanceCount(user1.address)).to.equal(1);
        });

        it("Should prevent dual claim for the same event", async function () {
            await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1", "secretcode");

            // even if time passes, cannot claim same event
            await time.increase(3600);

            await expect(crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1", "secretcode"))
                .to.be.revertedWithCustomError(crestCore, "AlreadyAttendedEvent");
        });

        it("Should fail to claim attendance with an incorrect passcode", async function () {
            await expect(crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1", "wrongcode"))
                .to.be.revertedWithCustomError(crestCore, "InvalidPasscode");
        });

        describe("Revocation", function () {
            it("Should allow the organizer to revoke an attendance", async function () {
                // User claims attendance
                const tx = await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1", "secretcode");
                const receipt = await tx.wait();

                // Extract attestationUid from the AttendanceClaimed event
                const claimedEvent = receipt?.logs.find(
                    (log: any) => log.fragment && log.fragment.name === "AttendanceClaimed"
                );
                const uid = claimedEvent?.args?.attestationUid;

                // Organizer revokes it
                await expect(crestCore.connect(organizer).revokeAttendance(eventId1, uid))
                    .to.emit(crestCore, "AttendanceRevoked")
                    .withArgs(organizer.address, eventId1, uid)
                    .and.to.emit(mockEAS, "Revoked")
                    .withArgs(uid, schemaUid);
            });

            it("Should not allow a non-organizer to revoke an attendance", async function () {
                // User claims attendance
                const tx = await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1", "secretcode");
                const receipt = await tx.wait();

                const claimedEvent = receipt?.logs.find(
                    (log: any) => log.fragment && log.fragment.name === "AttendanceClaimed"
                );
                const uid = claimedEvent?.args?.attestationUid;

                // user1 tries to revoke their own attendance or a random user tries
                await expect(crestCore.connect(user1).revokeAttendance(eventId1, uid))
                    .to.be.revertedWithCustomError(crestCore, "NotEventOrganizer");
            });

            it("Should prevent cross-event revocation exploits", async function () {
                // User claims attendance for event 1
                const tx1 = await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1", "secretcode");
                const receipt1 = await tx1.wait();
                const uid1 = receipt1?.logs.find((log: any) => log.fragment && log.fragment.name === "AttendanceClaimed")?.args?.attestationUid;

                // Organizer tries to revoke event 1 attestation using event 2's id
                await expect(crestCore.connect(organizer).revokeAttendance(eventId2, uid1))
                    .to.be.revertedWithCustomError(crestCore, "InvalidAttestation");
            });

            it("Should correctly downgrade tier when attendance count drops", async function () {
                // User claims attendance for event 1 and becomes Active
                const tx = await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1", "secretcode");
                const receipt = await tx.wait();
                const uid = receipt?.logs.find((log: any) => log.fragment && log.fragment.name === "AttendanceClaimed")?.args?.attestationUid;

                expect(await crestCore.userTiers(user1.address)).to.equal(1); // Active

                // Revoke attendance
                await expect(crestCore.connect(organizer).revokeAttendance(eventId1, uid))
                    .to.emit(crestCore, "TierDowngraded")
                    .withArgs(user1.address, 1, 0); // Should drop to Dormant 

                expect(await crestCore.userTiers(user1.address)).to.equal(0); // Dormant
                expect(await crestCore.attendanceCount(user1.address)).to.equal(0);
            });

            it("Should prevent revoked users from re-claiming the same event", async function () {
                // User claims attendance for event 1
                const tx1 = await crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1", "secretcode");
                const receipt1 = await tx1.wait();
                const uid1 = receipt1?.logs.find((log: any) => log.fragment && log.fragment.name === "AttendanceClaimed")?.args?.attestationUid;

                // Organizer revokes it
                await crestCore.connect(organizer).revokeAttendance(eventId1, uid1);

                // User tries to quickly re-claim the exact same event, even if they are Dormant and have 0 cooldown
                await expect(crestCore.connect(user1).claimAttendance(eventId1, 0, "hash1", "secretcode"))
                    .to.be.revertedWithCustomError(crestCore, "AlreadyAttendedEvent");
            });
        });
    });
});
